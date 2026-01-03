# Talk-To-My-Lawyer 🚀

**Status**: ✅ **LIVE PRODUCTION** - Real payment processing active

AI-powered legal letter generation platform with mandatory attorney review.

🌐 **Live Site**: https://www.talk-to-my-lawyer.com  
⚖️ **Admin Portal**: https://www.talk-to-my-lawyer.com/secure-admin-gateway  
📊 **System Status**: https://www.talk-to-my-lawyer.com/api/health

## 📚 Documentation

Comprehensive documentation is available in the `/docs` directory:

- **[Setup & Configuration Guide](docs/SETUP_AND_CONFIGURATION.md)** - Environment setup, database, admin users, test mode
- **[Architecture & Development Guide](docs/ARCHITECTURE_AND_DEVELOPMENT.md)** - System architecture, workflows, development guidelines
- **[API & Integrations Guide](docs/API_AND_INTEGRATIONS.md)** - Stripe, email, GitHub secrets, payment testing
- **[Deployment Guide](docs/DEPLOYMENT_GUIDE.md)** - Production deployment, CI/CD, monitoring, runbooks

## 🎯 Production Features (LIVE)

- ✅ **Real Payment Processing** - Stripe Live Mode with actual transactions
- ✅ **AI Letter Generation** - OpenAI GPT-4 Turbo integration
- ✅ **Attorney Review Workflow** - Multi-admin letter approval system
- ✅ **Subscription Management** - Monthly/Yearly plans with credit system
- ✅ **Employee Referrals** - 5% commission system with payout requests
- ✅ **Production Email System** - Professional templates via Resend
- ✅ **Security & Rate Limiting** - Upstash Redis protection
- ✅ **Admin Analytics** - Revenue, user, and performance dashboards

## 💳 Payment Plans (Live Production)

- **Single Letter**: $299 (1 letter, one-time payment)
- **Monthly Plan**: $299/month (4 letters per month) 
- **Yearly Plan**: $599/year (52 letters per year)
- **Free Trial**: First letter free for new users

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm
- Supabase account
- Stripe account
- OpenAI API key

### Installation

```bash
# Clone the repository
git clone https://github.com/moizjmj-pk/talk-to-my-lawyer.git
cd talk-to-my-lawyer

# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env.local

# Fill in your environment variables
# See docs/SETUP_AND_CONFIGURATION.md for details

# Run database migrations
pnpm db:migrate

# Start development server
pnpm dev
```

Visit http://localhost:3000

### Essential Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Development server
pnpm lint             # Linting (required before delivery)
CI=1 pnpm build       # Production build with strict checks
pnpm validate-env     # Validate environment variables
```

For detailed setup instructions, see **[Setup & Configuration Guide](docs/SETUP_AND_CONFIGURATION.md)**.


## 📖 Additional Resources

For more detailed information, see:

- **[Setup & Configuration](docs/SETUP_AND_CONFIGURATION.md)** - Complete setup guide
- **[Architecture & Development](docs/ARCHITECTURE_AND_DEVELOPMENT.md)** - System design and development
- **[API & Integrations](docs/API_AND_INTEGRATIONS.md)** - Third-party integrations
- **[Deployment Guide](docs/DEPLOYMENT_GUIDE.md)** - Production deployment and operations

## License

Private - All rights reserved
