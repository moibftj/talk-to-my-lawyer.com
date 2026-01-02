import Image from 'next/image'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DEFAULT_LOGO_ALT, DEFAULT_LOGO_SRC } from '@/lib/constants'

export default function CheckEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-muted/30 to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex items-center justify-center mb-4">
            <Image
              src={DEFAULT_LOGO_SRC}
              alt={DEFAULT_LOGO_ALT}
              width={56}
              height={56}
              className="h-14 w-14 rounded-full logo-badge"
              priority
            />
          </div>
          <CardTitle className="text-2xl font-bold">Check Your Email</CardTitle>
          <CardDescription>
            We've sent you a confirmation email. Please check your inbox and click the link to verify your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            After confirming your email, you'll be able to sign in and access your dashboard.
          </p>
          <Button asChild className="w-full">
            <Link href="/auth/login">
              Return to Sign In
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
