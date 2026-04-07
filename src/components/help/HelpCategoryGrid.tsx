import { getCategoriesWithCounts } from '@/lib/help'
import { HelpCategoryCard } from './HelpCategoryCard'

export function HelpCategoryGrid() {
  const categories = getCategoriesWithCounts()

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '1.25rem',
        width: '100%',
      }}
    >
      {categories.map((cat) => (
        <HelpCategoryCard key={cat.slug} category={cat} />
      ))}
    </div>
  )
}
