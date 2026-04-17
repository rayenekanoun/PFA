'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, Plus, AlertTriangle, CheckCircle2, Battery, Gauge } from 'lucide-react'

const mockCars = [
  { id: 1, make: 'Tesla', model: 'Model 3', year: 2023, vin: '5YJ3E1EA2CF352007', status: 'healthy', mileage: 15240, health: 92 },
  { id: 2, make: 'Chevy', model: 'Malibu', year: 2022, vin: '1G1ZD5ST3CF109186', status: 'healthy', mileage: 28950, health: 88 },
  { id: 3, make: 'Ford', model: 'F-150', year: 2021, vin: '1FTFW1ET5DFC13638', status: 'alert', mileage: 42100, health: 64 },
  { id: 4, make: 'Toyota', model: 'Prius', year: 2023, vin: '4T1BF1AK9CU045098', status: 'healthy', mileage: 8500, health: 95 },
  { id: 5, make: 'Honda', model: 'Civic', year: 2020, vin: '1HGCV1F32LA123456', status: 'warning', mileage: 68200, health: 76 },
]

export default function CarsPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCar, setSelectedCar] = useState<typeof mockCars[0] | null>(null)
  const [showDialog, setShowDialog] = useState(false)

  const filteredCars = mockCars.filter(
    (car) =>
      car.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
      car.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      car.vin.includes(searchTerm)
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-emerald-500/10 text-emerald-700 border-emerald-200'
      case 'warning':
        return 'bg-amber-500/10 text-amber-700 border-amber-200'
      case 'alert':
        return 'bg-red-500/10 text-red-700 border-red-200'
      default:
        return 'bg-slate-500/10 text-slate-700 border-slate-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="h-4 w-4" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4" />
      case 'alert':
        return <AlertTriangle className="h-4 w-4" />
      default:
        return null
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-foreground">Vehicles</h1>
          <p className="text-sm text-muted-foreground">Manage and monitor your connected vehicles</p>
        </div>
        <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          Add Vehicle
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by make, model, or VIN..."
          className="pl-10 bg-card border-border"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="bg-secondary">
          <TabsTrigger value="all" className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            All Vehicles ({filteredCars.length})
          </TabsTrigger>
          <TabsTrigger value="healthy" className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Healthy
          </TabsTrigger>
          <TabsTrigger value="alerts" className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Alerts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <Card className="bg-card border-border">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-muted/50">
                  <TableHead className="text-foreground">Vehicle</TableHead>
                  <TableHead className="text-foreground">VIN</TableHead>
                  <TableHead className="text-foreground">Mileage</TableHead>
                  <TableHead className="text-foreground">Health</TableHead>
                  <TableHead className="text-foreground">Status</TableHead>
                  <TableHead className="text-right text-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCars.map((car) => (
                  <TableRow key={car.id} className="border-border hover:bg-muted/30 cursor-pointer transition-colors">
                    <TableCell className="font-medium text-foreground">
                      {car.year} {car.make} {car.model}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">{car.vin.slice(-8)}</TableCell>
                    <TableCell className="text-foreground">{car.mileage.toLocaleString()} mi</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 rounded-full bg-muted">
                          <div className="h-2 rounded-full bg-primary" style={{ width: `${car.health}%` }}></div>
                        </div>
                        <span className="text-sm font-medium text-foreground">{car.health}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`flex w-fit items-center gap-1 ${getStatusColor(car.status)}`}>
                        {getStatusIcon(car.status)}
                        {car.status.charAt(0).toUpperCase() + car.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedCar(car)
                          setShowDialog(true)
                        }}
                        className="text-primary hover:text-primary hover:bg-primary/10"
                      >
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="healthy" className="mt-4">
          <Card className="bg-card border-border">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-muted/50">
                  <TableHead className="text-foreground">Vehicle</TableHead>
                  <TableHead className="text-foreground">VIN</TableHead>
                  <TableHead className="text-foreground">Mileage</TableHead>
                  <TableHead className="text-foreground">Health</TableHead>
                  <TableHead className="text-right text-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCars
                  .filter((car) => car.status === 'healthy')
                  .map((car) => (
                    <TableRow key={car.id} className="border-border hover:bg-muted/30">
                      <TableCell className="font-medium text-foreground">
                        {car.year} {car.make} {car.model}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-sm">{car.vin.slice(-8)}</TableCell>
                      <TableCell className="text-foreground">{car.mileage.toLocaleString()} mi</TableCell>
                      <TableCell>{car.health}%</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/10">
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="mt-4">
          <Card className="bg-card border-border">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-muted/50">
                  <TableHead className="text-foreground">Vehicle</TableHead>
                  <TableHead className="text-foreground">VIN</TableHead>
                  <TableHead className="text-foreground">Mileage</TableHead>
                  <TableHead className="text-foreground">Health</TableHead>
                  <TableHead className="text-foreground">Status</TableHead>
                  <TableHead className="text-right text-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCars
                  .filter((car) => car.status !== 'healthy')
                  .map((car) => (
                    <TableRow key={car.id} className="border-border hover:bg-muted/30">
                      <TableCell className="font-medium text-foreground">
                        {car.year} {car.make} {car.model}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-sm">{car.vin.slice(-8)}</TableCell>
                      <TableCell className="text-foreground">{car.mileage.toLocaleString()} mi</TableCell>
                      <TableCell>{car.health}%</TableCell>
                      <TableCell>
                        <Badge className={`flex w-fit items-center gap-1 ${getStatusColor(car.status)}`}>
                          {getStatusIcon(car.status)}
                          {car.status.charAt(0).toUpperCase() + car.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/10">
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl bg-card border-border">
          {selectedCar && (
            <>
              <DialogHeader>
                <DialogTitle className="text-foreground">
                  {selectedCar.year} {selectedCar.make} {selectedCar.model}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">Vehicle details and diagnostics</DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="details" className="w-full">
                <TabsList className="bg-secondary">
                  <TabsTrigger value="details" className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    Details
                  </TabsTrigger>
                  <TabsTrigger value="diagnostics" className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    Diagnostics
                  </TabsTrigger>
                  <TabsTrigger value="history" className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    History
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="mt-4 space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">VIN</span>
                      <span className="font-mono text-sm text-foreground">{selectedCar.vin}</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">Year</span>
                      <span className="text-sm text-foreground">{selectedCar.year}</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">Mileage</span>
                      <span className="text-sm text-foreground">{selectedCar.mileage.toLocaleString()} miles</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">Health Score</span>
                      <span className="text-sm font-semibold text-primary">{selectedCar.health}%</span>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="diagnostics" className="mt-4 space-y-3">
                  <p className="text-sm text-muted-foreground">Latest diagnostic results</p>
                  {selectedCar.status !== 'healthy' && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
                      <p className="text-sm text-amber-900">Action required: Review diagnostic codes and schedule maintenance</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="history" className="mt-4">
                  <p className="text-sm text-muted-foreground">Diagnostic history would be displayed here</p>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
