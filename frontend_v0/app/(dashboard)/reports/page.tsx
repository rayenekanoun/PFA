'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Download, Calendar, Filter, Eye, Plus, FileText, AlertCircle } from 'lucide-react'

interface Report {
  id: string
  name: string
  vehicle: string
  type: 'diagnostic' | 'maintenance' | 'health' | 'compliance'
  date: Date
  status: 'ready' | 'generating' | 'expired'
  pages: number
}

const mockReports: Report[] = [
  {
    id: '1',
    name: 'Q1 Fleet Diagnostic Report',
    vehicle: 'All Vehicles',
    type: 'diagnostic',
    date: new Date('2025-04-01'),
    status: 'ready',
    pages: 12,
  },
  {
    id: '2',
    name: 'Tesla Model 3 Health Assessment',
    vehicle: 'Tesla Model 3',
    type: 'health',
    date: new Date('2025-04-10'),
    status: 'ready',
    pages: 8,
  },
  {
    id: '3',
    name: 'Ford F-150 Maintenance Schedule',
    vehicle: 'Ford F-150',
    type: 'maintenance',
    date: new Date('2025-04-08'),
    status: 'ready',
    pages: 5,
  },
  {
    id: '4',
    name: 'Fleet Compliance Audit',
    vehicle: 'All Vehicles',
    type: 'compliance',
    date: new Date('2025-03-15'),
    status: 'ready',
    pages: 15,
  },
  {
    id: '5',
    name: 'Chevy Malibu Diagnostic Report',
    vehicle: 'Chevy Malibu',
    type: 'diagnostic',
    date: new Date('2025-04-05'),
    status: 'ready',
    pages: 6,
  },
  {
    id: '6',
    name: 'Toyota Prius Health Snapshot',
    vehicle: 'Toyota Prius',
    type: 'health',
    date: new Date('2025-04-02'),
    status: 'expired',
    pages: 4,
  },
]

export default function ReportsPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [filterType, setFilterType] = useState<string>('all')

  const filteredReports = mockReports.filter(
    (report) =>
      (report.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.vehicle.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (filterType === 'all' || report.type === filterType)
  )

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'diagnostic':
        return 'bg-blue-500/10 text-blue-700 border-blue-200'
      case 'maintenance':
        return 'bg-purple-500/10 text-purple-700 border-purple-200'
      case 'health':
        return 'bg-emerald-500/10 text-emerald-700 border-emerald-200'
      case 'compliance':
        return 'bg-orange-500/10 text-orange-700 border-orange-200'
      default:
        return 'bg-slate-500/10 text-slate-700 border-slate-200'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
        return 'bg-emerald-500/10 text-emerald-700 border-emerald-200'
      case 'generating':
        return 'bg-amber-500/10 text-amber-700 border-amber-200'
      case 'expired':
        return 'bg-red-500/10 text-red-700 border-red-200'
      default:
        return 'bg-slate-500/10 text-slate-700 border-slate-200'
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground">Download and manage diagnostic reports</p>
        </div>
        <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          Generate Report
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3 pt-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Reports</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">{mockReports.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3 pt-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ready</CardTitle>
            <Calendar className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">{mockReports.filter((r) => r.status === 'ready').length}</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3 pt-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Generating</CardTitle>
            <Calendar className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">{mockReports.filter((r) => r.status === 'generating').length}</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3 pt-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expired</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">{mockReports.filter((r) => r.status === 'expired').length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[250px]">
          <Input
            placeholder="Search reports..."
            className="bg-card border-border"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={filterType === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('all')}
            className={filterType === 'all' ? 'bg-primary text-primary-foreground' : 'border-border text-foreground hover:bg-muted'}
          >
            All
          </Button>
          <Button
            variant={filterType === 'diagnostic' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('diagnostic')}
            className={filterType === 'diagnostic' ? 'bg-primary text-primary-foreground' : 'border-border text-foreground hover:bg-muted'}
          >
            Diagnostic
          </Button>
          <Button
            variant={filterType === 'health' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('health')}
            className={filterType === 'health' ? 'bg-primary text-primary-foreground' : 'border-border text-foreground hover:bg-muted'}
          >
            Health
          </Button>
          <Button
            variant={filterType === 'maintenance' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('maintenance')}
            className={filterType === 'maintenance' ? 'bg-primary text-primary-foreground' : 'border-border text-foreground hover:bg-muted'}
          >
            Maintenance
          </Button>
        </div>
      </div>

      {/* Reports Table */}
      <Card className="bg-card border-border flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-muted/50">
              <TableHead className="text-foreground">Report Name</TableHead>
              <TableHead className="text-foreground">Vehicle</TableHead>
              <TableHead className="text-foreground">Type</TableHead>
              <TableHead className="text-foreground">Date</TableHead>
              <TableHead className="text-foreground">Pages</TableHead>
              <TableHead className="text-foreground">Status</TableHead>
              <TableHead className="text-right text-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredReports.map((report) => (
              <TableRow key={report.id} className="border-border hover:bg-muted/30">
                <TableCell className="font-medium text-foreground">{report.name}</TableCell>
                <TableCell className="text-muted-foreground">{report.vehicle}</TableCell>
                <TableCell>
                  <Badge className={`${getTypeColor(report.type)}`}>{report.type}</Badge>
                </TableCell>
                <TableCell className="text-foreground">{report.date.toLocaleDateString()}</TableCell>
                <TableCell className="text-foreground">{report.pages}</TableCell>
                <TableCell>
                  <Badge className={`${getStatusColor(report.status)}`}>{report.status}</Badge>
                </TableCell>
                <TableCell className="text-right space-x-2 flex justify-end">
                  {report.status === 'ready' && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedReport(report)
                          setShowPreview(true)
                        }}
                        className="text-primary hover:text-primary hover:bg-primary/10"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-primary hover:text-primary hover:bg-primary/10"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {report.status !== 'ready' && (
                    <span className="text-sm text-muted-foreground">{report.status}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh] bg-card border-border p-0 overflow-hidden">
          {selectedReport && (
            <>
              <DialogHeader className="border-b border-border p-6">
                <DialogTitle className="text-foreground">{selectedReport.name}</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  {selectedReport.vehicle} • {selectedReport.date.toLocaleDateString()} • {selectedReport.pages} pages
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-auto p-6">
                <div className="space-y-6">
                  <div className="rounded-lg bg-muted p-8">
                    <h2 className="text-2xl font-bold text-foreground mb-2">{selectedReport.name}</h2>
                    <p className="text-muted-foreground">Generated on {selectedReport.date.toLocaleDateString()}</p>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground">Executive Summary</h3>
                    <p className="text-foreground/80">
                      This report provides a comprehensive analysis of the vehicle diagnostics and health assessment. All systems have been
                      evaluated against industry standards and manufacturer specifications.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground">Key Findings</h3>
                    <ul className="list-disc list-inside space-y-2 text-foreground/80">
                      <li>All critical systems operational</li>
                      <li>Battery health at {Math.floor(Math.random() * 20) + 80}%</li>
                      <li>Engine performance within normal parameters</li>
                      <li>No pending diagnostic codes</li>
                    </ul>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground">Recommendations</h3>
                    <ul className="list-disc list-inside space-y-2 text-foreground/80">
                      <li>Schedule routine maintenance within 1000 miles</li>
                      <li>Rotate tires to ensure even wear</li>
                      <li>Check fluid levels monthly</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="border-t border-border p-6 flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowPreview(false)} className="border-border text-foreground hover:bg-muted">
                  Close
                </Button>
                <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                  <Download className="h-4 w-4" />
                  Download PDF
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
