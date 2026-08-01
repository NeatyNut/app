import { useMemo, useState, type ChangeEvent } from 'react'
import './App.css'

type SchoolType = 'general' | 'special' | 'vocational' | 'ged'
type Gender = 'male' | 'female'
type Subject = 'kor' | 'math' | 'eng' | 'soc' | 'sci'

interface GradeYear {
  kor: string
  math: string
  eng: string
  soc: string
  sci: string
}

interface ConsultingState {
  gender: Gender
  gradYear: string
  schoolType: SchoolType
  grades: {
    1: GradeYear
    2: GradeYear
    3: GradeYear
  }
  careerElectives: { a: number; b: number; c: number }
  location: string
  priority: number
  interest: string
}

type Strategy = '상향' | '적정' | '안정'

interface RecommendationCard {
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
    cut70: number
    competitionRate: number
    changeType: string
  }>
  report: string
}

interface RecommendationResponse {
  studentGrade: number
  searchRange: [number, number]
  dataMode: 'mvp_estimated_metrics'
  summary: {
    totalCandidates: number
    tracedCandidates: number
    selectedCards: number
    strategyCounts: Record<Strategy, number>
  }
  cards: RecommendationCard[]
}

declare global {
  interface Window {
    electron?: {
      send: (channel: string, payload: ConsultingState) => void
    }
  }
}

const subjects: Array<{ key: Subject; label: string }> = [
  { key: 'kor', label: '국어' },
  { key: 'math', label: '수학' },
  { key: 'eng', label: '영어' },
  { key: 'soc', label: '사회' },
  { key: 'sci', label: '과학' },
]

function App() {
  const [result, setResult] = useState<RecommendationResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState<ConsultingState>({
    gender: 'male',
    gradYear: '2024',
    schoolType: 'general',
    grades: {
      1: { kor: '', math: '', eng: '', soc: '', sci: '' },
      2: { kor: '', math: '', eng: '', soc: '', sci: '' },
      3: { kor: '', math: '', eng: '', soc: '', sci: '' },
    },
    careerElectives: { a: 0, b: 0, c: 0 },
    location: 'seoul',
    priority: 50,
    interest: '',
  })

  const gradeAverage = useMemo(() => calculateGradeAverage(formData), [formData])

  const handleChange = (
    e: ChangeEvent<HTMLSelectElement | HTMLInputElement>,
  ) => {
    const { name, value } = e.target

    setFormData((prev) => ({
      ...prev,
      [name]: name === 'priority' ? Number(value) : value,
    }))
  }

  const handleGradeChange = (
    year: 1 | 2 | 3,
    subject: Subject,
    value: string,
  ) => {
    setFormData((prev) => ({
      ...prev,
      grades: {
        ...prev.grades,
        [year]: { ...prev.grades[year], [subject]: value },
      },
    }))
  }

  const startConsulting = async (): Promise<void> => {
    setError('')

    if (!gradeAverage) {
      setError('국·수·영·사·과 내신 등급을 최소 1개 이상 입력해 주세요.')
      return
    }

    if (window.electron) {
      window.electron.send('start-agent', formData)
    }

    setIsLoading(true)

    try {
      const response = await fetch('http://localhost:4000/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade_average: gradeAverage }),
      })

      if (!response.ok) {
        throw new Error('추천 API 응답이 올바르지 않습니다.')
      }

      const nextResult = (await response.json()) as RecommendationResponse
      setResult(nextResult)
    } catch (apiError) {
      setError('백엔드 서버 연결을 확인해 주세요. 기본 포트는 4000입니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="consulting-shell">
      <nav className="sidebar">
        <div className="brand-block">
          <p className="brand-eyebrow">AI Agent Consultant</p>
          <h1>수시 PASS</h1>
          <p className="brand-copy">
            학생부 흐름과 지원 우선순위를 빠르게 정리하는 상담 입력
            워크스페이스입니다.
          </p>
        </div>

        <div className="sidebar-step is-active">기본 정보 입력</div>
        <div className="sidebar-step">분석 결과 리포트</div>

        <div className="sidebar-footer">
          <span className="status-dot" />
          Ontology RAG MVP 대기 중
        </div>
      </nav>

      <main className="consulting-main">
        <header className="page-header">
          <div>
            <p className="section-kicker">Strategy Intake</p>
            <h2>2027 수시 6카드 추천</h2>
            <p className="page-copy">
              국·수·영·사·과 내신 평균을 기반으로 4개년 전형 추적과
              규칙 기반 Reranking을 실행합니다.
            </p>
          </div>
          <div className="header-card">
            <span>현재 평균 등급</span>
            <strong>{gradeAverage ? `${gradeAverage.toFixed(2)} 등급` : '입력 대기'}</strong>
          </div>
        </header>

        <section className="form-section">
          <div className="section-title">
            <p>Step 1</p>
            <h3>기본 인적 사항</h3>
          </div>

          <div className="panel info-grid">
            <label className="field">
              <span>성별</span>
              <select name="gender" value={formData.gender} onChange={handleChange}>
                <option value="male">남성</option>
                <option value="female">여성</option>
              </select>
            </label>

            <label className="field">
              <span>졸업(예정)년도</span>
              <select
                name="gradYear"
                value={formData.gradYear}
                onChange={handleChange}
              >
                <option value="2024">2024 (현 고3)</option>
                <option value="2023">2023 (재수)</option>
                <option value="2022">2022 이전</option>
              </select>
            </label>

            <label className="field">
              <span>고교 유형</span>
              <select
                name="schoolType"
                value={formData.schoolType}
                onChange={handleChange}
              >
                <option value="general">일반고</option>
                <option value="special">특목고</option>
                <option value="vocational">특성화고</option>
                <option value="ged">검정고시</option>
              </select>
            </label>
          </div>
        </section>

        <section className="form-section">
          <div className="section-title">
            <p>Step 2</p>
            <h3>학년별 내신 성적</h3>
          </div>

          <div className="panel grade-panel">
            <div className="grade-table-wrap">
              <table className="grade-table">
                <thead>
                  <tr>
                    <th>학년</th>
                    {subjects.map((subject) => (
                      <th key={subject.key}>{subject.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {([1, 2, 3] as const).map((year) => (
                    <tr key={year}>
                      <td className="year-cell">{year}학년</td>
                      {subjects.map((subject) => (
                        <td key={subject.key}>
                          <input
                            type="number"
                            step="0.1"
                            min="1"
                            max="9"
                            value={formData.grades[year][subject.key]}
                            placeholder="0.0"
                            onChange={(e) =>
                              handleGradeChange(year, subject.key, e.target.value)
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="form-section">
          <div className="section-title">
            <p>Step 3</p>
            <h3>분석 가중치 설정</h3>
          </div>

          <div className="panel weight-panel">
            <label className="field">
              <span>희망 전공 / 학과</span>
              <input
                name="interest"
                type="text"
                value={formData.interest}
                onChange={handleChange}
                placeholder="예: 컴퓨터공학부, 인공지능학전공"
              />
            </label>

            <div className="priority-block">
              <div className="priority-header">
                <span
                  className={
                    formData.priority < 50 ? 'priority-label is-active' : 'priority-label'
                  }
                >
                  학교 타이틀 우선
                </span>
                <strong>{100 - formData.priority} : {formData.priority}</strong>
                <span
                  className={
                    formData.priority > 50 ? 'priority-label is-active' : 'priority-label'
                  }
                >
                  학과 전공 우선
                </span>
              </div>

              <input
                className="priority-range"
                type="range"
                name="priority"
                min="0"
                max="100"
                value={formData.priority}
                onChange={handleChange}
              />
            </div>
          </div>
        </section>

        {error && <div className="error-banner">{error}</div>}

        <button className="cta-button" onClick={startConsulting} disabled={isLoading}>
          {isLoading ? '추천 후보 추적 중...' : 'Ontology RAG 추천 실행'}
        </button>

        {result && (
          <section className="result-section">
            <div className="result-header">
              <div>
                <p className="section-kicker">Recommendation Report</p>
                <h3>2027학년도 수시 추천 6카드</h3>
              </div>
              <div className="summary-strip">
                <span>탐색 {result.searchRange[0]}~{result.searchRange[1]}</span>
                <span>후보 {result.summary.tracedCandidates}개</span>
                <span>상향 {result.summary.strategyCounts.상향}</span>
                <span>적정 {result.summary.strategyCounts.적정}</span>
                <span>안정 {result.summary.strategyCounts.안정}</span>
              </div>
            </div>

            <div className="cards-grid">
              {result.cards.map((card) => (
                <article className="recommend-card" key={`${card.university}-${card.department}-${card.admissionName}`}>
                  <div className="card-topline">
                    <span className={`strategy-badge strategy-${card.strategy}`}>
                      {card.strategy}
                    </span>
                    <strong>{card.score.toFixed(1)}</strong>
                  </div>

                  <h4>{card.university} {card.department}</h4>
                  <p className="admission-line">{card.admissionName} · {card.admissionType}</p>

                  <div className="metric-row">
                    <span>예측컷 <strong>{card.predictedCut.toFixed(2)}</strong></span>
                    <span>모집 <strong>{card.seats}</strong></span>
                    <span>최저 <strong>{card.csatLevel || '없음'}</strong></span>
                  </div>

                  <div className="reason-list">
                    {card.reasons.map((reason) => (
                      <span key={reason}>{reason}</span>
                    ))}
                  </div>

                  <div className="trace-line" aria-label="4개년 전형 추적">
                    {card.trace.map((trace) => (
                      <div className="trace-node" key={trace.year}>
                        <strong>{trace.year}</strong>
                        <span>{trace.cut70.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  <p className="report-copy">{card.report}</p>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

function calculateGradeAverage(formData: ConsultingState): number | null {
  const values = Object.values(formData.grades).flatMap((year) =>
    subjects
      .map((subject) => Number(year[subject.key]))
      .filter((value) => Number.isFinite(value) && value >= 1 && value <= 9),
  )

  if (values.length === 0) {
    return null
  }

  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100
}

export default App
