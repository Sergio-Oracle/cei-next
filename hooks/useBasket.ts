'use client'
/**
 * useBasket
 * Manages the in-memory "basket" of questions selected for saving to the bank
 * (shown as a floating counter and sidebar in create-subject / suggestions pages).
 */
import { useCallback, useState } from 'react'

export interface BasketItem {
  text: string
  type: 'qcm' | 'vf' | 'open' | 'subopen'
  bloom: string
  ecId?: number | null
}

export interface UseBasketReturn {
  basket: BasketItem[]
  add: (item: BasketItem) => void
  remove: (index: number) => void
  clear: () => void
  contains: (text: string) => boolean
}

export function useBasket(): UseBasketReturn {
  const [basket, setBasket] = useState<BasketItem[]>([])

  const add = useCallback((item: BasketItem) => {
    setBasket(prev => [...prev, item])
  }, [])

  const remove = useCallback((index: number) => {
    setBasket(prev => prev.filter((_, i) => i !== index))
  }, [])

  const clear = useCallback(() => setBasket([]), [])

  const contains = useCallback(
    (text: string) => basket.some(b => b.text === text),
    [basket],
  )

  return { basket, add, remove, clear, contains }
}
