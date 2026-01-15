# 🚀 Quick Setup Instructions - Fix Auth Error

Your `.env.local` file has been created with secure random secrets!

## ✅ What's Already Done

1. **`.env.local` created** - Located at the project root
2. **Supabase URL configured** - `https://nomiiqzxaxyxnxndvkbe.supabase.co`
3. **Security secrets generated** - CSRF_SECRET, ADMIN_PORTAL_KEY, CRON_SECRET
4. **Git protection verified** - `.env.local` is in `.gitignore` (won't be committed)

## ⚠️ What You Need to Do (REQUIRED)

### Step 1: Get Your Supabase Anon Key (CRITICAL - Fixes Auth Error)

1. Go to: https://supabase.com/dashboard
2. Select your project: `nomiiqzxaxyxnxndvkbe`
3. Navigate to: **Settings** → **API**
4. Copy the **`anon`** or **`public`** key (they're the same thing)
5. Open `.env.local` in your editor
6. Paste the key into **line 27**: `NEXT_PUBLIC_SUPABASE_ANON_KEY=`

**This is the MINIMUM required to fix the 401 auth error!**

### Step 2: Restart Your Dev Server

```bash
# Stop the current dev server (Ctrl+C)
# Then restart:
pnpm dev
```

After restarting, try signing up again - the 401 error should be gone!

---

## 📋 Optional: Additional API Keys (for full functionality)

For the app to work completely, you'll need these additional keys:

### OpenAI (for AI letter generation)
- Get from: https://platform.openai.com/api-keys
- Add to line 31: `OPENAI_API_KEY=sk-...`

### Stripe (for payment processing)
- Get from: https://dashboard.stripe.com/apikeys
- Use **test mode** keys for development
- Add to lines 44-47:
  - `STRIPE_SECRET_KEY=sk_test_...`
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...`
  - `STRIPE_WEBHOOK_SECRET=whsec_...` (from webhook setup)

### Resend (for sending emails)
- Get from: https://resend.com/api-keys
- Add to line 71: `RESEND_API_KEY=re_...`
- Set line 76: `EMAIL_FROM=noreply@yourdomain.com`

### Supabase Service Role Key (server-side operations)
- Get from same Supabase API page as the anon key
- Look for **`service_role`** key
- Add to line 39: `SUPABASE_SERVICE_ROLE_KEY=...`

---

## 🔍 Verification

After adding your Supabase anon key and restarting:

1. **Open browser console** (F12)
2. **Go to** http://localhost:3000/auth/signup
3. **Check for errors** - Should NOT see "Missing Supabase environment variables"
4. **Try signing up** - Should NOT get 401 error

If you still see errors, check:
- Did you paste the anon key correctly? (no extra spaces)
- Did you restart the dev server?
- Is the key from the correct Supabase project?

---

## 🎯 Summary

**To fix auth immediately:**
1. Add `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local` (line 27)
2. Restart dev server (`pnpm dev`)
3. Test signup/login

**For full functionality later:**
- Add OpenAI key (letter generation)
- Add Stripe keys (payments)
- Add Resend key (emails)

---

## 🔒 Security Notes

- ✅ `.env.local` is already in `.gitignore` - safe to add real secrets
- ✅ Security secrets (CSRF, Admin, Cron) are pre-generated
- ⚠️ NEVER commit `.env.local` to Git
- ⚠️ Use different keys for production (via Vercel environment variables)

---

## 💡 Quick Reference

**Your Supabase Project:**
- Project: `nomiiqzxaxyxnxndvkbe`
- Dashboard: https://supabase.com/dashboard
- Direct link: https://supabase.com/dashboard/project/nomiiqzxaxyxnxndvkbe/settings/api

**File Locations:**
- Environment config: `.env.local` (at project root)
- Example template: `.env.example`
- This guide: `SETUP_INSTRUCTIONS.md`

**Need Help?**
- Check the full setup guide: `docs/SETUP_AND_CONFIGURATION.md`
- Validate your config: `pnpm validate-env` (after adding keys)

---

**Next step:** Add your Supabase anon key to `.env.local` line 27, then restart! 🚀
