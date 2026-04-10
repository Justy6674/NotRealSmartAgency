'use client'

import { useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  type ChartOptions,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
)

export interface ChartBarProps {
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
  /** Y-axis label (e.g. "Engagement"). */
  yLabel?: string
}

/**
 * Thin react-chartjs-2 wrapper for bar charts. Mirrors Mixpost Pro's
 * ChartBar.vue API surface (re-implemented in TypeScript) — title, single
 * or dual series, brand colour mapping, no Mixpost JS code copied.
 */
export function ChartBar({
  labels,
  data,
  colour,
  title,
  comparisonData,
  comparisonLabel,
  height = 240,
  yLabel,
}: ChartBarProps) {
  const chartData = useMemo(() => {
    const datasets: Array<{
      label: string
      data: number[]
      backgroundColor: string
      borderRadius: number
      borderSkipped: false
    }> = [
      {
        label: title ?? 'Value',
        data,
        backgroundColor: colour,
        borderRadius: 6,
        borderSkipped: false,
      },
    ]

    if (comparisonData && comparisonData.length === labels.length) {
      datasets.push({
        label: comparisonLabel ?? 'Previous period',
        data: comparisonData,
        backgroundColor: `${colour}55`,
        borderRadius: 6,
        borderSkipped: false,
      })
    }

    return { labels, datasets }
  }, [labels, data, colour, title, comparisonData, comparisonLabel])

  const options = useMemo<ChartOptions<'bar'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: !!comparisonData, position: 'top' as const },
        title: { display: !!title, text: title ?? '' },
        tooltip: { enabled: true },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { autoSkip: true, maxRotation: 0 },
        },
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
      <Bar data={chartData} options={options} />
    </div>
  )
}
