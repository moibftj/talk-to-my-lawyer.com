import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkAndDeductAllowance, rollbackAllowance } from '@/lib/services/allowance-service'
import { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server')

describe('Allowance Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('checkAndDeductAllowance', () => {
    it('should successfully deduct allowance when user has credits', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: {
            success: true,
            new_balance: 4,
            message: 'Allowance deducted successfully',
          },
          error: null,
        }),
      }
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

      const result = await checkAndDeductAllowance('user-123')

      expect(result.success).toBe(true)
      expect(result.newBalance).toBe(4)
      expect(mockSupabase.rpc).toHaveBeenCalledWith('check_and_deduct_allowance', {
        p_user_id: 'user-123',
      })
    })

    it('should fail when user has insufficient credits', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: {
            success: false,
            message: 'Insufficient allowance',
          },
          error: null,
        }),
      }
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

      const result = await checkAndDeductAllowance('user-123')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Insufficient allowance')
    })

    it('should handle database errors gracefully', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database connection failed' },
        }),
      }
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

      await expect(checkAndDeductAllowance('user-123')).rejects.toThrow(
        'Failed to check and deduct allowance'
      )
    })
  })

  describe('rollbackAllowance', () => {
    it('should successfully rollback allowance', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: {
            success: true,
            new_balance: 5,
          },
          error: null,
        }),
      }
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

      const result = await rollbackAllowance('user-123')

      expect(result.success).toBe(true)
      expect(result.newBalance).toBe(5)
      expect(mockSupabase.rpc).toHaveBeenCalledWith('rollback_allowance', {
        p_user_id: 'user-123',
      })
    })

    it('should handle rollback errors', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Rollback failed' },
        }),
      }
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

      await expect(rollbackAllowance('user-123')).rejects.toThrow(
        'Failed to rollback allowance'
      )
    })
  })
})
