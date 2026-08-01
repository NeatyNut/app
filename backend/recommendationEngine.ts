export type Strategy = '상향' | '적정' | '안정'

interface CsvRow {
  [key: string]: string
}

interface AdmissionNode {
  id: string
  year: number
  region: string
  university: string
  college: string
  department: string
  admissionGroup: string
  admissionType: string
  admissionName: string
  seats: number
  eligibility: string
  method: string
}

interface MetricNode {
  admissionId: string
  year: number
  cut70: number
  cut90: number
  competitionRate: number
  recruitment: number
  trendNote: string
}

interface RuleNode {
  admissionId: string
  csatRequired: boolean
  csatLevel: number
  postCsatEvent: boolean
  naptchiRisk: boolean
  recommendationRequired: boolean
  interviewDate: string
}

interface Candidate {
  current: AdmissionNode
  metrics: MetricNode[]
  rule: RuleNode
  evolutionPath: AdmissionNode[]
}

export interface RecommendationCard {
  strategy: Strategy
  university: string
  college: string
  department: string
  admissionType: string
  admissionName: string
  seats: number
  score: number
  predictedCut: number
  gradeGap: number
  csatLevel: number
  naptchiRisk: boolean
  postCsatEvent: boolean
  reasons: string[]
  trace: Array<{
    year: number
    id: string
    cut70: number
    competitionRate: number
    changeType: string
  }>
  report: string
}

export interface RecommendationResponse {
  studentGrade: number
  searchRange: [number, number]
  generatedAt: string
  dataMode: 'mvp_estimated_metrics'
  summary: {
    totalCandidates: number
    tracedCandidates: number
    selectedCards: number
    strategyCounts: Record<Strategy, number>
  }
  cards: RecommendationCard[]
}

const YEAR_SEQUENCE = [2024, 2025, 2026, 2027]

export function buildRecommendations(csv: string, gradeAverage: number): RecommendationResponse {
  const rows = parseCsv(csv)
  const candidates = rows.map(rowToCandidate).filter(Boolean) as Candidate[]
  const [minGrade, maxGrade] = [
    roundGrade(Math.max(1, gradeAverage - 0.3)),
    roundGrade(Math.min(9, gradeAverage + 0.3)),
  ]

  const inRange = candidates.filter((candidate) => {
    const metric2024 = getMetric(candidate, 2024)
    return metric2024.cut70 >= minGrade && metric2024.cut70 <= maxGrade
  })

  const traced = (inRange.length >= 6 ? inRange : nearestCandidates(candidates, gradeAverage))
    .map((candidate) => scoreCandidate(candidate, gradeAverage))
    .sort((a, b) => b.score - a.score)

  const cards = selectSixCards(traced)
  const strategyCounts: Record<Strategy, number> = { 상향: 0, 적정: 0, 안정: 0 }
  cards.forEach((card) => {
    strategyCounts[card.strategy] += 1
  })

  return {
    studentGrade: roundGrade(gradeAverage),
    searchRange: [minGrade, maxGrade],
    generatedAt: new Date().toISOString(),
    dataMode: 'mvp_estimated_metrics',
    summary: {
      totalCandidates: candidates.length,
      tracedCandidates: traced.length,
      selectedCards: cards.length,
      strategyCounts,
    },
    cards,
  }
}

function parseCsv(csv: string): CsvRow[] {
  const text = csv.replace(/^\uFEFF/, '')
  const records: string[][] = []
  let record: string[] = []
  let field = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (char === '"' && quoted && next === '"') {
      field += '"'
      index += 1
      continue
    }

    if (char === '"') {
      quoted = !quoted
      continue
    }

    if (char === ',' && !quoted) {
      record.push(field)
      field = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') {
        index += 1
      }
      record.push(field)
      if (record.some((value) => value.trim() !== '')) {
        records.push(record)
      }
      record = []
      field = ''
      continue
    }

    field += char
  }

  if (field || record.length > 0) {
    record.push(field)
    records.push(record)
  }

  const [rawHeaders, ...body] = records
  if (!rawHeaders) {
    return []
  }

  const headers = uniquifyHeaders(rawHeaders)
  return body.map((values) =>
    headers.reduce<CsvRow>((row, header, index) => {
      row[header] = (values[index] ?? '').trim()
      return row
    }, {}),
  )
}

function uniquifyHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>()
  return headers.map((header) => {
    const cleanHeader = header.trim().replace(/^\uFEFF/, '')
    const count = seen.get(cleanHeader) ?? 0
    seen.set(cleanHeader, count + 1)
    return count === 0 ? cleanHeader : `${cleanHeader}_${count + 1}`
  })
}

function rowToCandidate(row: CsvRow): Candidate | null {
  const university = row['대학'] || ''
  const department = row['학과'] || ''
  const admissionName = row['전형명'] || ''

  if (!university || !department || !admissionName) {
    return null
  }

  const baseId = normalizeId(`${university}-${department}-${row['전형유형']}-${admissionName}`)
  const seats = parseNumber(row['인원'])
  const current: AdmissionNode = {
    id: `${baseId}:2027`,
    year: 2027,
    region: row['지역'] || '',
    university,
    college: row['대학_2'] || '',
    department,
    admissionGroup: row['일반/특별'] || '',
    admissionType: row['전형유형'] || '',
    admissionName,
    seats,
    eligibility: row['지원자격'] || '',
    method: row['전형방법'] || '',
  }
  const rule = buildRule(current.id, row)
  const metrics = YEAR_SEQUENCE.map((year) => buildMetric(`${baseId}:${year}`, year, current, rule))
  const evolutionPath = YEAR_SEQUENCE.map((year) => ({
    ...current,
    id: `${baseId}:${year}`,
    year,
  }))

  return {
    current,
    metrics,
    rule,
    evolutionPath,
  }
}

function buildRule(admissionId: string, row: CsvRow): RuleNode {
  const requiredSubjects = ['국어', '수학', '영어', '탐구'].filter((key) => isMarked(row[key])).length
  const gradeSum = parseNumber(row['등급합'])
  const csatRequired = requiredSubjects > 0 && gradeSum > 0
  const csatLevel = csatRequired ? toCsatLevel(gradeSum, requiredSubjects) : 0
  const interviewDate = row['면접일자'] || ''
  const postCsatEvent = isPostCsatEvent(interviewDate)
  const naptchiRisk = !csatRequired && !postCsatEvent

  return {
    admissionId,
    csatRequired,
    csatLevel,
    postCsatEvent,
    naptchiRisk,
    recommendationRequired: parseNumber(row['학교장추천']) > 0 || (row['지원자격']?.includes('추천') ?? false),
    interviewDate,
  }
}

function buildMetric(
  admissionId: string,
  year: number,
  admission: AdmissionNode,
  rule: RuleNode,
): MetricNode {
  const baseSelectivity = getUniversitySelectivity(admission.university)
  const idNoise = hashToUnit(`${admission.id}:${year}`)
  const methodNoise = admission.admissionType.includes('교과') ? -0.12 : 0.08
  const csatEffect = rule.csatLevel >= 4 ? 0.28 : rule.csatLevel >= 2 ? 0.12 : 0
  const yearDrift = (year - 2024) * (hashToUnit(admission.department) - 0.46) * 0.09
  const cut70 = roundGrade(baseSelectivity + methodNoise + idNoise * 0.85 + yearDrift + csatEffect)
  const competitionRate = roundOne(4.2 + hashToUnit(`${admission.id}:competition:${year}`) * 8.5)

  return {
    admissionId,
    year,
    cut70,
    cut90: roundGrade(cut70 + 0.22),
    competitionRate,
    recruitment: admission.seats,
    trendNote: year === 2027 ? '2027 후보 매핑' : `${year} 입결 추정 메트릭`,
  }
}

function scoreCandidate(candidate: Candidate, gradeAverage: number): RecommendationCard {
  const metric2024 = getMetric(candidate, 2024)
  const metric2026 = getMetric(candidate, 2026)
  const metric2027 = getMetric(candidate, 2027)
  const trend = metric2024.cut70 - metric2026.cut70
  const gradeGap = roundGrade(gradeAverage - metric2027.cut70)
  const isSafetyCombo = candidate.current.admissionType.includes('교과') && candidate.rule.postCsatEvent
  const fitScore = Math.max(0, 100 - Math.abs(gradeGap) * 42)
  const reachScore =
    48 +
    Math.max(0, gradeGap) * 28 +
    candidate.rule.csatLevel * 5.5 +
    (candidate.rule.naptchiRisk ? 12 : 0) +
    Math.max(0, trend) * 8
  const safetyScore =
    64 -
    Math.max(0, gradeGap) * 34 +
    (candidate.current.admissionType.includes('교과') ? 9 : 0) +
    (candidate.rule.postCsatEvent ? 11 : 0) +
    (isSafetyCombo ? 10 : 0) -
    (candidate.rule.naptchiRisk ? 12 : 0)
  const strategy = classifyStrategy(reachScore, safetyScore, gradeGap)
  const score = roundOne(strategy === '안정' ? safetyScore : strategy === '상향' ? reachScore : fitScore)
  const reasons = buildReasons(candidate, strategy, trend, gradeGap, isSafetyCombo)
  const trace = candidate.metrics.map((metric, index) => ({
    year: metric.year,
    id: candidate.evolutionPath[index]?.id ?? metric.admissionId,
    cut70: metric.cut70,
    competitionRate: metric.competitionRate,
    changeType: metric.year === 2024 ? 'START' : 'EVOLVED_TO',
  }))

  return {
    strategy,
    university: candidate.current.university,
    college: candidate.current.college,
    department: candidate.current.department,
    admissionType: candidate.current.admissionType,
    admissionName: candidate.current.admissionName,
    seats: candidate.current.seats,
    score,
    predictedCut: metric2027.cut70,
    gradeGap,
    csatLevel: candidate.rule.csatLevel,
    naptchiRisk: candidate.rule.naptchiRisk,
    postCsatEvent: candidate.rule.postCsatEvent,
    reasons,
    trace,
    report: buildReport(candidate, strategy, reasons, gradeAverage, metric2027.cut70, gradeGap),
  }
}

function nearestCandidates(candidates: Candidate[], gradeAverage: number): Candidate[] {
  return [...candidates]
    .sort((a, b) => Math.abs(getMetric(a, 2024).cut70 - gradeAverage) - Math.abs(getMetric(b, 2024).cut70 - gradeAverage))
    .slice(0, 80)
}

function selectSixCards(cards: RecommendationCard[]): RecommendationCard[] {
  const quotas: Record<Strategy, number> = { 상향: 2, 적정: 2, 안정: 2 }
  const selected: RecommendationCard[] = []

  ;(['상향', '적정', '안정'] as Strategy[]).forEach((strategy) => {
    selected.push(...cards.filter((card) => card.strategy === strategy).slice(0, quotas[strategy]))
  })

  if (selected.length < 6) {
    const selectedKeys = new Set(selected.map(cardKey))
    selected.push(...cards.filter((card) => !selectedKeys.has(cardKey(card))).slice(0, 6 - selected.length))
  }

  return selected.sort((a, b) => {
    const order: Record<Strategy, number> = { 상향: 0, 적정: 1, 안정: 2 }
    return order[a.strategy] - order[b.strategy] || b.score - a.score
  })
}

function classifyStrategy(reachScore: number, safetyScore: number, gradeGap: number): Strategy {
  if (safetyScore >= 72 && gradeGap <= 0.25) {
    return '안정'
  }
  if (reachScore >= 68 || gradeGap > 0.18) {
    return '상향'
  }
  return '적정'
}

function buildReasons(
  candidate: Candidate,
  strategy: Strategy,
  trend: number,
  gradeGap: number,
  isSafetyCombo: boolean,
): string[] {
  const reasons: string[] = []

  if (strategy === '상향' && candidate.rule.naptchiRisk) {
    reasons.push('수능 전 합격 가능성이 있어 상향 카드로만 활용 권장')
  }
  if (candidate.rule.csatLevel >= 4) {
    reasons.push('높은 수능 최저로 실질 경쟁률 하락 기대')
  }
  if (trend > 0.08) {
    reasons.push('최근 추정 입결이 완화되는 흐름')
  }
  if (isSafetyCombo) {
    reasons.push('교과 전형이며 수능 후 면접 일정이 있어 선택권 확보')
  }
  if (gradeGap <= 0) {
    reasons.push('사용자 내신이 예측 컷보다 우위')
  }
  if (candidate.current.seats >= 10) {
    reasons.push('모집인원이 비교적 안정적')
  }

  return reasons.slice(0, 4)
}

function buildReport(
  candidate: Candidate,
  strategy: Strategy,
  reasons: string[],
  gradeAverage: number,
  predictedCut: number,
  gradeGap: number,
): string {
  const gapText =
    gradeGap > 0
      ? `예측 컷보다 ${roundGrade(gradeGap)}등급 정도 도전 구간`
      : `예측 컷보다 ${Math.abs(roundGrade(gradeGap))}등급 정도 여유`

  return `${candidate.current.university} ${candidate.current.department} ${candidate.current.admissionName}은 ${strategy} 카드로 분류됩니다. 학생 내신 ${roundGrade(
    gradeAverage,
  )} 기준 ${gapText}이며, ${reasons.join(', ')} 요소가 핵심 판단 근거입니다. 최종 지원 전에는 2027 모집요강 원문과 수능 최저 충족 가능성을 함께 확인해야 합니다.`
}

function getMetric(candidate: Candidate, year: number): MetricNode {
  const metric = candidate.metrics.find((item) => item.year === year)
  if (!metric) {
    throw new Error(`Metric not found: ${year}`)
  }
  return metric
}

function getUniversitySelectivity(university: string): number {
  if (university.includes('서울대')) return 1.18
  if (university.includes('연세대') || university.includes('고려대')) return 1.42
  if (university.includes('서강대') || university.includes('성균관대') || university.includes('한양대')) return 1.68
  if (university.includes('중앙대') || university.includes('경희대') || university.includes('이화여대')) return 1.92
  return 2.24
}

function toCsatLevel(gradeSum: number, subjects: number): number {
  const perSubject = gradeSum / Math.max(1, subjects)
  if (perSubject <= 1.5) return 5
  if (perSubject <= 2) return 4
  if (perSubject <= 2.5) return 3
  if (perSubject <= 3) return 2
  return 1
}

function isPostCsatEvent(value: string): boolean {
  const monthMatch = value.match(/(\d{4}\.)?(\d{1,2})\./)
  const month = Number(monthMatch?.[2] ?? 0)
  return month >= 11 || value.includes('수능 후')
}

function isMarked(value = ''): boolean {
  return ['O', 'o', '○', 'Y', 'y'].includes(value.trim())
}

function parseNumber(value = ''): number {
  const parsed = Number(value.replace(/[^\d.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeId(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^가-힣a-z0-9:-]/g, '')
}

function hashToUnit(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }
  return (hash >>> 0) / 4294967295
}

function roundGrade(value: number): number {
  return Math.round(value * 100) / 100
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10
}

function cardKey(card: RecommendationCard): string {
  return `${card.university}-${card.department}-${card.admissionName}`
}
