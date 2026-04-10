'use client'

import { useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Title,
  Tooltip,
  Legend,
  type ChartOptions,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Title,
  Tooltip,
  Legend
)

export interface ChartLineProps {
  labels: string[]
  data: number[]
  /** Hex colour from PLATFORM_BRAND_COLOURS. */
  colour: string
  title?: string
  /** Optional second series — used for period-over-period comparisons. */
  comparisonData?: number[]
  comparisonLabel?: string
  /** Pixel height of the chart canvas. */
  height?: number
  yLabel?: string
  /** Fill the area under the line — useful for follower-growth charts. */
  area?: boolean
}

/**
 * Thin react-chartjs-2 wrapper for line charts. Mirrors Mixpost Pro's
 * ChartLine.vue API (re-implemented from scratch) — single or dual series,
 * optional area fill, brand colour, no Mixpost JS code copied.
 */
export function ChartLine({
  labels,
  data,
  colour,
  title,
  comparisonData,
  comparisonLabel,
  height = 240,
  yLabel,
  area = true,
}: ChartLineProps) {
  const chartData = useMemo(() => {
    const datasets: Array<{
      label: string
      data: number[]
      borderColor: string
      backgroundColor: string
      tension: number
      fill: boolean
      pointRadius: number
      pointHoverRadius: number
    }> = [
      {
        label: title ?? 'Value',
        data,
        borderColor: colour,
        backgroundColor: area ? `${colour}22` : 'transparent',
        tension: 0.35,
        fill: area,
        pointRadius: 2,
        pointHoverRadius: 5,
      },
    ]

    if (comparisonData && comparisonData.length === labels.length) {
      datasets.push({
        label: comparisonLabel ?? 'Previous period',
        data: comparisonData,
        borderColor: `${colour}88`,
        backgroundColor: 'transparent',
        tension: 0.35,
        fill: false,
        pointRadius: 2,
        pointHoverRadius: 5,
      })
    }

    return { labels, datasets }
  }, [labels, data, colour, title, comparisonData, comparisonLabel, area])

  const options = useMemo<ChartOptions<'line'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' as const },
      plugins: {
        legend: { display: !!comparisonData, position: 'top' as const },
        title: { display: !!title, text: title ?? '' },
        tooltip: { enabled: true },
      },
      scales: {
        x: { grid: { display: false }, ticks: { autoSkip: true, maxRotation: 0 } },
        y: {
          beginAtZero: true,
          title: yLabel
            ? { display: true, text: yLabel }
            : { display: false, text: '' },
          ticks: {
            callback: (value: string | number) =>
              typeof value === 'number' && value >= 1000
                ? `${(value / 1000).toFixed(1)}k`
                : value,
          },
        },
      },
    }),
    [title, yLabel, comparisonData]
  )

  return (
    <div style={{ height: `${height}px` }} className="w-full">
      <Line data={chartData} options={options} />
    </div>
  )
}
