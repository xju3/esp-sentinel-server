import { useEffect, useMemo, useState } from 'react'

type TabKey = 'machine_state' | 'rms_report'

type QueryMeta = {
  page_size: number
  curr_page: number
  total?: number
}

type QueryResult = {
  items: Record<string, unknown>[]
  meta: QueryMeta
}

const API_BASE = import.meta.env.VITE_API_BASE ?? ''
const MACHINE_STATE_PATH = import.meta.env.VITE_MACHINE_STATE_PATH ?? '/machine-state'
const RMS_REPORT_PATH = import.meta.env.VITE_RMS_REPORT_PATH ?? '/rms-report'

const TAB_CONFIG: Record<TabKey, { label: string; description: string; path: string }> = {
  machine_state: {
    label: 'Machine State',
    description: '设备状态查询',
    path: MACHINE_STATE_PATH,
  },
  rms_report: {
    label: 'RMS Report',
    description: '振动数据报表查询',
    path: RMS_REPORT_PATH,
  },
}

function toInt(value: unknown, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function extractItems(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload as Record<string, unknown>[]
  }
  if (payload && typeof payload === 'object') {
    const data = payload as Record<string, unknown>
    const candidates = [data.items, data.data, data.events, data.list]
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate as Record<string, unknown>[]
      }
    }
  }
  return []
}

function extractMeta(payload: unknown, fallback: QueryMeta): QueryMeta {
  if (!payload || typeof payload !== 'object') {
    return fallback
  }
  const data = payload as Record<string, unknown>
  const pageSize = toInt(data.page_size ?? data.pageSize ?? fallback.page_size, fallback.page_size)
  const currPage = toInt(data.curr_page ?? data.currPage ?? data.page ?? fallback.curr_page, fallback.curr_page)
  const total = Number.isFinite(Number(data.total)) ? Number(data.total) : undefined

  return {
    page_size: pageSize,
    curr_page: currPage,
    total,
  }
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

async function fetchQuery(tab: TabKey, sn: string, meta: QueryMeta): Promise<QueryResult> {
  if (!API_BASE) {
    return { items: [], meta }
  }

  const url = new URL(TAB_CONFIG[tab].path, API_BASE)
  if (sn.trim()) {
    url.searchParams.set('sn', sn.trim())
  }
  url.searchParams.set('page_size', String(meta.page_size))
  url.searchParams.set('curr_page', String(meta.curr_page))

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`请求失败: ${res.status}`)
  }
  const payload = (await res.json()) as unknown

  const items = extractItems(payload)
  const nextMeta = extractMeta(payload, meta)

  return { items, meta: nextMeta }
}

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('machine_state')
  const [sn, setSn] = useState('')
  const [pageSize, setPageSize] = useState(20)
  const [currPage, setCurrPage] = useState(1)
  const [items, setItems] = useState<Record<string, unknown>[]>([])
  const [meta, setMeta] = useState<QueryMeta>({ page_size: 20, curr_page: 1 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canQuery = useMemo(() => !loading, [loading])

  const columns = useMemo(() => {
    if (items.length === 0) return []
    const first = items[0]
    return Object.keys(first)
  }, [items])

  const hasNextPage = useMemo(() => {
    if (!meta.total) return true
    return meta.curr_page * meta.page_size < meta.total
  }, [meta])

  const onQuery = async (nextPage?: number) => {
    const targetPage = nextPage ?? currPage
    const nextMeta = {
      page_size: pageSize,
      curr_page: targetPage,
      total: meta.total,
    }

    setLoading(true)
    setError(null)
    try {
      const result = await fetchQuery(activeTab, sn, nextMeta)
      setItems(result.items)
      setMeta(result.meta)
      setCurrPage(result.meta.curr_page)
      setPageSize(result.meta.page_size)
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setItems([])
    setMeta({ page_size: pageSize, curr_page: currPage })
    if (API_BASE) {
      void onQuery(1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
        <header className="flex flex-col gap-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Sentinel Web</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Machine State / RMS Report 查询
          </h1>
          <p className="max-w-2xl text-base text-slate-600">
            一个双 TAB 查询页面。参数可为空或传入 SN，支持分页（page_size=20, curr_page=1）。
          </p>
        </header>

        <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {Object.entries(TAB_CONFIG).map(([key, tab]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key as TabKey)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  activeTab === key
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="text-sm text-slate-500">{TAB_CONFIG[activeTab].description}</div>

          <div className="grid gap-3 sm:grid-cols-[1.2fr_0.6fr_0.6fr_auto]">
            <input
              value={sn}
              onChange={(event) => setSn(event.target.value)}
              placeholder="SN (可为空)"
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
            />
            <input
              value={pageSize}
              onChange={(event) => setPageSize(toInt(event.target.value, 20))}
              type="number"
              min={1}
              placeholder="page_size"
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
            />
            <input
              value={currPage}
              onChange={(event) => setCurrPage(toInt(event.target.value, 1))}
              type="number"
              min={1}
              placeholder="curr_page"
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
            />
            <button
              type="button"
              onClick={() => onQuery()}
              disabled={!canQuery}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {loading ? '查询中...' : '查询'}
            </button>
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-slate-500">
            <span className="rounded-full bg-slate-100 px-3 py-1">sn 可为空</span>
            <span className="rounded-full bg-slate-100 px-3 py-1">page_size 默认 20</span>
            <span className="rounded-full bg-slate-100 px-3 py-1">curr_page 默认 1</span>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">查询结果</h2>
            <div className="text-xs text-slate-500">
              page {meta.curr_page} / size {meta.page_size}
              {meta.total !== undefined ? ` / total ${meta.total}` : ''}
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
              {error}
            </div>
          )}

          {!error && items.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
              暂无结果。请确认接口返回或调整查询条件。
            </div>
          )}

          {items.length > 0 && (
            <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {columns.map((col) => (
                      <th
                        key={col}
                        className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((row, index) => (
                    <tr key={row.id ? String(row.id) : `row-${index}`} className="hover:bg-slate-50">
                      {columns.map((col) => (
                        <td key={col} className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {formatValue(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onQuery(Math.max(1, currPage - 1))}
              disabled={loading || currPage <= 1}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              上一页
            </button>
            <button
              type="button"
              onClick={() => onQuery(currPage + 1)}
              disabled={loading || !hasNextPage}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

export default App
