'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FieldGroup, FieldLabel } from '@/components/ui/field'
import { useRouter } from 'next/navigation'
import { Activity, ArrowRight } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    // Simulate login
    setTimeout(() => {
      router.push('/overview')
    }, 500)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo Section */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Activity className="h-6 w-6" />
            </div>
            <span className="text-2xl font-bold text-foreground">DiagHub</span>
          </div>
          <p className="text-sm text-muted-foreground">Enterprise Vehicle Diagnostics Platform</p>
        </div>

        {/* Login Card */}
        <Card className="bg-card border-border shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-foreground">Welcome Back</CardTitle>
            <CardDescription className="text-muted-foreground">Sign in to your account to access the diagnostic dashboard</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleLogin} className="space-y-6">
              <FieldGroup>
                <FieldLabel className="text-foreground">Email</FieldLabel>
                <Input
                  type="email"
                  placeholder="name@company.com"
                  className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </FieldGroup>

              <FieldGroup>
                <div className="flex items-center justify-between">
                  <FieldLabel className="text-foreground">Password</FieldLabel>
                  <Button variant="link" className="h-auto p-0 text-sm text-primary hover:text-primary/80">
                    Forgot password?
                  </Button>
                </div>
                <Input
                  type="password"
                  placeholder="••••••••"
                  className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </FieldGroup>

              <Button
                type="submit"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                disabled={isLoading}
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
                {!isLoading && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>

            <div className="mt-6 relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-card text-muted-foreground">Or continue as demo user</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full mt-6 border-border text-foreground hover:bg-muted"
              onClick={() => {
                setEmail('demo@diaghub.com')
                setPassword('demo123')
              }}
            >
              Load Demo Account
            </Button>
          </CardContent>
        </Card>

        {/* Features */}
        <div className="grid gap-3 text-sm">
          <div className="flex gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10 text-primary flex-shrink-0">✓</div>
            <div className="flex flex-col gap-1">
              <span className="font-medium text-foreground">Real-Time Diagnostics</span>
              <span className="text-muted-foreground">Monitor vehicle health continuously</span>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10 text-primary flex-shrink-0">✓</div>
            <div className="flex flex-col gap-1">
              <span className="font-medium text-foreground">Advanced Analytics</span>
              <span className="text-muted-foreground">Get actionable insights on fleet performance</span>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10 text-primary flex-shrink-0">✓</div>
            <div className="flex flex-col gap-1">
              <span className="font-medium text-foreground">Predictive Maintenance</span>
              <span className="text-muted-foreground">Prevent issues before they happen</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          By signing in, you agree to our{' '}
          <Button variant="link" className="h-auto p-0 text-primary hover:text-primary/80">
            Terms of Service
          </Button>{' '}
          and{' '}
          <Button variant="link" className="h-auto p-0 text-primary hover:text-primary/80">
            Privacy Policy
          </Button>
        </p>
      </div>
    </div>
  )
}
