'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FieldGroup, FieldLabel } from '@/components/ui/field'
import { AlertCircle, Bell, Lock, User, Shield } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 overflow-auto p-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account and application preferences</p>
      </div>

      <Tabs defaultValue="account" className="w-full">
        <TabsList className="bg-secondary">
          <TabsTrigger value="account" className="flex gap-2 text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <User className="h-4 w-4" />
            Account
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex gap-2 text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="security" className="flex gap-2 text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Lock className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="billing" className="flex gap-2 text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Shield className="h-4 w-4" />
            Billing
          </TabsTrigger>
        </TabsList>

        {/* Account Tab */}
        <TabsContent value="account" className="mt-6 space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Account Information</CardTitle>
              <CardDescription className="text-muted-foreground">Update your profile and account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FieldGroup>
                <FieldLabel className="text-foreground">Full Name</FieldLabel>
                <Input
                  placeholder="John Doe"
                  className="bg-secondary border-border text-foreground"
                  defaultValue="John Doe"
                />
              </FieldGroup>

              <FieldGroup>
                <FieldLabel className="text-foreground">Email Address</FieldLabel>
                <Input
                  type="email"
                  placeholder="john@company.com"
                  className="bg-secondary border-border text-foreground"
                  defaultValue="john@company.com"
                />
              </FieldGroup>

              <FieldGroup>
                <FieldLabel className="text-foreground">Organization</FieldLabel>
                <Input
                  placeholder="Your Company"
                  className="bg-secondary border-border text-foreground"
                  defaultValue="Fleet Management Corp"
                />
              </FieldGroup>

              <div className="flex gap-2 pt-4">
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Save Changes</Button>
                <Button variant="outline" className="border-border text-foreground hover:bg-muted">
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="mt-6 space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Alert Preferences</CardTitle>
              <CardDescription className="text-muted-foreground">Choose what notifications you want to receive</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-foreground">Critical Alerts</span>
                  <span className="text-sm text-muted-foreground">Immediate notifications for critical vehicle issues</span>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between border-t border-border pt-4">
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-foreground">Diagnostic Reports</span>
                  <span className="text-sm text-muted-foreground">Weekly summary of vehicle diagnostics</span>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between border-t border-border pt-4">
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-foreground">Maintenance Reminders</span>
                  <span className="text-sm text-muted-foreground">Scheduled maintenance notifications</span>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between border-t border-border pt-4">
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-foreground">Device Status</span>
                  <span className="text-sm text-muted-foreground">Updates when devices connect or disconnect</span>
                </div>
                <Switch />
              </div>

              <div className="flex gap-2 pt-4 border-t border-border">
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Save Preferences</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="mt-6 space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Password</CardTitle>
              <CardDescription className="text-muted-foreground">Update your password to keep your account secure</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FieldGroup>
                <FieldLabel className="text-foreground">Current Password</FieldLabel>
                <Input type="password" placeholder="••••••••" className="bg-secondary border-border text-foreground" />
              </FieldGroup>

              <FieldGroup>
                <FieldLabel className="text-foreground">New Password</FieldLabel>
                <Input type="password" placeholder="••••••••" className="bg-secondary border-border text-foreground" />
              </FieldGroup>

              <FieldGroup>
                <FieldLabel className="text-foreground">Confirm Password</FieldLabel>
                <Input type="password" placeholder="••••••••" className="bg-secondary border-border text-foreground" />
              </FieldGroup>

              <div className="flex gap-2 pt-4">
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Update Password</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Two-Factor Authentication</CardTitle>
              <CardDescription className="text-muted-foreground">Add an extra layer of security to your account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-foreground">Enable 2FA</span>
                  <span className="text-sm text-muted-foreground">Authenticate using an authenticator app</span>
                </div>
                <Switch />
              </div>

              <div className="flex gap-2 pt-4 border-t border-border">
                <Button variant="outline" className="border-border text-foreground hover:bg-muted">
                  Configure 2FA
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="mt-6 space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Subscription</CardTitle>
              <CardDescription className="text-muted-foreground">Manage your billing and subscription plan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-primary/5">
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-foreground">Professional Plan</span>
                  <span className="text-sm text-muted-foreground">$99/month • Renews April 15, 2025</span>
                </div>
                <Button variant="outline" className="border-border text-foreground hover:bg-muted">
                  Change Plan
                </Button>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Plan Features:</p>
                <ul className="space-y-2">
                  <li className="flex gap-2 text-sm text-muted-foreground">
                    <span className="text-primary">✓</span>
                    Up to 50 vehicles
                  </li>
                  <li className="flex gap-2 text-sm text-muted-foreground">
                    <span className="text-primary">✓</span>
                    Real-time diagnostics
                  </li>
                  <li className="flex gap-2 text-sm text-muted-foreground">
                    <span className="text-primary">✓</span>
                    Advanced analytics
                  </li>
                  <li className="flex gap-2 text-sm text-muted-foreground">
                    <span className="text-primary">✓</span>
                    Priority support
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border border-amber-200 bg-amber-50/30">
            <CardHeader>
              <div className="flex gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <CardTitle className="text-foreground">Billing Help</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Need to update your billing information or view invoices?{' '}
                <Button variant="link" className="h-auto p-0 text-primary hover:text-primary/80">
                  Contact our billing team
                </Button>
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
