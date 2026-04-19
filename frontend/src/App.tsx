import { useState, type ChangeEvent } from 'react'
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

  const startConsulting = (): void => {
    if (window.electron) {
      window.electron.send('start-agent', formData)
      return
    }

    console.warn('Electron API not found. Data:', formData)
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
          Gemma 4 연결 대기 중
        </div>
      </nav>

      <main className="consulting-main">
        <header className="page-header">
          <div>
            <p className="section-kicker">Strategy Intake</p>
            <h2>맞춤형 컨설팅 정보 입력</h2>
            <p className="page-copy">
              입력하신 데이터를 기반으로 Gemma 4가 최적의 수시 전략을
              분석합니다.
            </p>
          </div>
          <div className="header-card">
            <span>현재 분석 모드</span>
            <strong>학생부 종합 + 교과 균형 추천</strong>
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

        <button className="cta-button" onClick={startConsulting}>
          Gemma 4 에이전트 분석 시작
        </button>
      </main>
    </div>
  )
}

export default App
