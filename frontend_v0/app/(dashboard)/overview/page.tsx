'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { AlertTriangle, TrendingUp, Activity, Zap } from 'lucide-react'

const vehicleHealthData = [
  { name: 'Excellent', value: 12, fill: 'hsl(var(--color-chart-1))' },
  { name: 'Good', value: 28, fill: 'hsl(var(--color-chart-2))' },
  { name: 'Fair', value: 8, fill: 'hsl(var(--color-chart-3))' },
  { name: 'Alert', value: 2, fill: 'hsl(var(--color-destructive))' },
]

const diagnosticTrendData = [
  { date: 'Mon', diagnostics: 24, issues: 2 },
  { date: 'Tue', diagnostics: 32, issues: 3 },
  { date: 'Wed', diagnostics: 28, issues: 1 },
  { date: 'Thu', diagnostics: 41, issues: 4 },
  { date: 'Fri', diagnostics: 35, issues: 2 },
  { date: 'Sat', diagnostics: 22, issues: 0 },
  { date: 'Sun', diagnostics: 18, issues: 1 },
]

export default function OverviewPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 overflow-auto p-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of your connected vehicle fleet and diagnostics</p>
      </div>

      {/* Alert */}
      <Alert className="border-destructive/30 bg-destructive/5">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <AlertDescription className="text-foreground">
          <strong>2 vehicles</strong> require attention. One has critical engine diagnostics and another has battery issues.
        </AlertDescription>
      </Alert>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3 pt-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Vehicles</CardTitle>
            <Car className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">50</div>
            <p className="text-xs text-muted-foreground">+2 this week</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3 pt-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Diagnostics Run</CardTitle>
            <Activity className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">1,247</div>
            <p className="text-xs text-muted-foreground">+144 this week</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3 pt-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Issues Found</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">23</div>
            <p className="text-xs text-muted-foreground">-5 since last week</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3 pt-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Health Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">87%</div>
            <p className="text-xs text-muted-foreground">+3% this month</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Vehicle Health Distribution */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Vehicle Health Distribution</CardTitle>
            <CardDescription>Fleet health status breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={vehicleHealthData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value">
                  {vehicleHealthData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Diagnostic Trends */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Weekly Diagnostics</CardTitle>
            <CardDescription>Diagnostics and issues identified</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={diagnosticTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--color-border))" />
                <XAxis dataKey="date" stroke="hsl(var(--color-muted-foreground))" style={{ fontSize: '12px' }} />
                <YAxis stroke="hsl(var(--color-muted-foreground))" style={{ fontSize: '12px' }} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--color-card))', border: '1px solid hsl(var(--color-border))' }} />
                <Legend />
                <Bar dataKey="diagnostics" fill="hsl(var(--color-primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="issues" fill="hsl(var(--color-destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Recent Diagnostics</CardTitle>
          <CardDescription>Latest vehicle diagnostics and status updates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { vehicle: 'Tesla Model 3', status: 'Warning', message: 'Battery optimization recommended', time: '2 hours ago' },
              { vehicle: 'Chevy Malibu', status: 'Good', message: 'All systems operational', time: '4 hours ago' },
              { vehicle: 'Ford F-150', status: 'Alert', message: 'Engine code P0128 detected', time: '6 hours ago' },
              { vehicle: 'Toyota Prius', status: 'Good', message: 'Routine maintenance scheduled', time: '1 day ago' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between border-b border-border pb-4 last:border-0">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-foreground">{item.vehicle}</p>
                  <p className="text-xs text-muted-foreground">{item.message}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant={item.status === 'Good' ? 'secondary' : item.status === 'Alert' ? 'destructive' : 'outline'}>
                    {item.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{item.time}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Icon component reference
import { Car } from 'lucide-react'
