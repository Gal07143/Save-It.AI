import { useState, useEffect } from 'react'
import { Link } from 'wouter'
import { Star, ChevronDown, X, Building2, Gauge, FileText } from 'lucide-react'

interface Favorite {
  id: string
  type: 'page' | 'site' | 'meter'
  name: string
  path: string
}

const FAVORITES_KEY = 'saveit_favorites'

function getStoredFavorites(): Favorite[] {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveFavorites(favorites: Favorite[]): void {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites))
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<Favorite[]>(() => getStoredFavorites())

  const addFavorite = (favorite: Omit<Favorite, 'id'>) => {
    const newFavorite = { ...favorite, id: Date.now().toString() }
    const updated = [...favorites, newFavorite]
    setFavorites(updated)
    saveFavorites(updated)
  }

  const removeFavorite = (id: string) => {
    const updated = favorites.filter(f => f.id !== id)
    setFavorites(updated)
    saveFavorites(updated)
  }

  const isFavorite = (path: string) => favorites.some(f => f.path === path)

  return { favorites, addFavorite, removeFavorite, isFavorite }
}

const typeIcons: Record<string, React.ElementType> = {
  page: FileText,
  site: Building2,
  meter: Gauge,
}

export default function FavoritesDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const { favorites, removeFavorite } = useFavorites()

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: '0.5rem 0.75rem',
          background: 'transparent',
          border: '1px solid #334155',
          borderRadius: '0.5rem',
          color: '#94a3b8',
          cursor: 'pointer',
          fontSize: '0.813rem',
        }}
      >
        <Star size={16} color="#f59e0b" fill="#f59e0b" />
        Favorites
        <ChevronDown size={14} />
      </button>

      {isOpen && (
        <>
          <div 
            style={{ position: 'fixed', inset: 0, zIndex: 999 }}
            onClick={() => setIsOpen(false)}
          />
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 0.5rem)',
            right: 0,
            width: '280px',
            maxHeight: '320px',
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '0.75rem',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)',
            zIndex: 1000,
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '0.75rem 1rem',
              borderBottom: '1px solid #334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span style={{ 
                fontSize: '0.813rem', 
                fontWeight: 600, 
                color: '#f1f5f9',
              }}>
                Favorites
              </span>
              <span style={{ 
                fontSize: '0.7rem', 
                color: '#64748b',
              }}>
                {favorites.length} items
              </span>
            </div>

            <div style={{
              maxHeight: '240px',
              overflowY: 'auto',
            }}>
              {favorites.length === 0 ? (
                <div style={{
                  padding: '1.5rem',
                  textAlign: 'center',
                  color: '#64748b',
                }}>
                  <Star size={24} style={{ opacity: 0.5, marginBottom: '0.5rem' }} />
                  <p style={{ margin: 0, fontSize: '0.813rem' }}>
                    No favorites yet
                  </p>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem' }}>
                    Click the star icon to add pages
                  </p>
                </div>
              ) : (
                favorites.map(favorite => {
                  const Icon = typeIcons[favorite.type] || FileText
                  
                  return (
                    <div
                      key={favorite.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.625rem 1rem',
                        borderBottom: '1px solid #334155',
                      }}
                    >
                      <Icon size={16} color="#10b981" />
                      <Link
                        href={favorite.path}
                        style={{
                          flex: 1,
                          color: '#f1f5f9',
                          textDecoration: 'none',
                          fontSize: '0.813rem',
                        }}
                        onClick={() => setIsOpen(false)}
                      >
                        {favorite.name}
                      </Link>
                      <button
                        onClick={() => removeFavorite(favorite.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '0.25rem',
                          color: '#64748b',
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function FavoriteButton({ 
  type, 
  name, 
  path,
}: { 
  type: 'page' | 'site' | 'meter'
  name: string
  path: string
}) {
  const { favorites, addFavorite, removeFavorite, isFavorite } = useFavorites()
  const starred = isFavorite(path)
  const favorite = favorites.find(f => f.path === path)

  const handleClick = () => {
    if (starred && favorite) {
      removeFavorite(favorite.id)
    } else {
      addFavorite({ type, name, path })
    }
  }

  return (
    <button
      onClick={handleClick}
      style={{
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: '0.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      title={starred ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Star 
        size={18} 
        color={starred ? '#f59e0b' : '#64748b'}
        fill={starred ? '#f59e0b' : 'transparent'}
      />
    </button>
  )
}
