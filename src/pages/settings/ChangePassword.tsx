import { useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { apiFetch } from '@/utils/apiFetch'

function scorePassword(password: string): number {
  let score = 0
  if (password.length >= 8) score += 1
  if (/[A-Z]/.test(password)) score += 1
  if (/[0-9]/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1
  return score
}

export default function ChangePassword() {
  const [form, setForm] = useState({ current: '', newPass: '', confirm: '' })
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const strengthScore = useMemo(() => scorePassword(form.newPass), [form.newPass])
  const isValid = form.current.length > 0 && form.newPass.length >= 8 && form.newPass === form.confirm

  async function handleSubmit() {
    setSaving(true)
    setSaveSuccess(false)
    setSaveError(null)

    try {
      await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: form.current, newPassword: form.newPass }),
      })
      setSaveSuccess(true)
      setForm({ current: '', newPass: '', confirm: '' })
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to update password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-full bg-[#0a0a0a] px-8 py-7">
      <div className="mb-8">
        <p className="mb-1 text-[11px] font-medium uppercase tracking-widest text-[#404040]">Settings · Account</p>
        <h1 className="text-[22px] font-semibold text-[#fafafa]">Change password</h1>
      </div>

      <div className="max-w-sm space-y-5 rounded-2xl bg-[#111111] p-5">
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">Current password</label>
          <div className="relative">
            <input
              type={showCurrent ? 'text' : 'password'}
              value={form.current}
              onChange={(event) => setForm((prev) => ({ ...prev, current: event.target.value }))}
              className="w-full rounded-xl bg-[#1a1a1a] px-3 py-2.5 pr-10 text-[13px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
            />
            <button
              onClick={() => setShowCurrent((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3f3f46] transition-colors hover:text-[#52525b]"
            >
              {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">New password</label>
          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              value={form.newPass}
              onChange={(event) => setForm((prev) => ({ ...prev, newPass: event.target.value }))}
              className="w-full rounded-xl bg-[#1a1a1a] px-3 py-2.5 pr-10 text-[13px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
            />
            <button
              onClick={() => setShowNew((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3f3f46] transition-colors hover:text-[#52525b]"
            >
              {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          {form.newPass.length > 0 && (
            <div className="mt-1.5 flex items-center gap-2">
              {[...Array(4)].map((_, idx) => (
                <div
                  key={idx}
                  className="h-0.5 flex-1 rounded-full transition-colors duration-300"
                  style={{
                    backgroundColor:
                      idx < strengthScore
                        ? strengthScore <= 1
                          ? '#ef4444'
                          : strengthScore <= 2
                            ? '#f59e0b'
                            : strengthScore <= 3
                              ? '#22c55e'
                              : '#16a34a'
                        : '#1a1a1a',
                  }}
                />
              ))}
              <p className="w-12 shrink-0 text-[10px] text-[#52525b]">{['', 'Weak', 'Fair', 'Good', 'Strong'][strengthScore]}</p>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">Confirm new password</label>
          <input
            type="password"
            value={form.confirm}
            onChange={(event) => setForm((prev) => ({ ...prev, confirm: event.target.value }))}
            className={`w-full rounded-xl bg-[#1a1a1a] px-3 py-2.5 text-[13px] text-[#a1a1aa] outline-none transition-all duration-150 ${
              form.confirm && form.confirm !== form.newPass
                ? 'ring-1 ring-[#ef4444]'
                : form.confirm && form.confirm === form.newPass
                  ? 'ring-1 ring-[#22c55e]'
                  : 'focus:ring-1 focus:ring-[#6366f1]'
            }`}
          />
          {form.confirm && form.confirm !== form.newPass && <p className="text-[11px] text-[#ef4444]">Passwords do not match</p>}
        </div>

        <p className="text-[11px] text-[#3f3f46]">Minimum 8 characters. Use a mix of letters, numbers, and symbols.</p>

        {saveSuccess && (
          <div className="flex items-center gap-2 rounded-xl border border-[#22c55e]/15 bg-[#22c55e]/8 px-4 py-3">
            <CheckCircle2 size={13} className="shrink-0 text-[#22c55e]" />
            <p className="text-[12px] text-[#a1a1aa]">Password changed successfully.</p>
          </div>
        )}

        {saveError && (
          <div className="flex items-center gap-2 rounded-xl border border-[#ef4444]/15 bg-[#ef4444]/8 px-4 py-3">
            <AlertCircle size={13} className="shrink-0 text-[#ef4444]" />
            <p className="text-[12px] text-[#a1a1aa]">{saveError}</p>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={saving || !isValid}
          className="w-full rounded-xl bg-[#6366f1] py-2.5 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-[#4f46e5] disabled:opacity-40"
        >
          {saving ? 'Updating...' : 'Update password'}
        </button>
      </div>
    </div>
  )
}
