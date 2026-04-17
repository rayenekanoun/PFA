'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, Plus, Wifi, WifiOff, Battery, Signal } from 'lucide-react'

const mockDevices = [
  { id: 1, name: 'OBD2 Scanner - Car 1', type: 'OBD2', vehicle: 'Tesla Model 3', status: 'connected', battery: 92, signal: 95 },
  { id: 2, name: 'GPS Tracker - Car 2', type: 'GPS', vehicle: 'Chevy Malibu', status: 'connected', battery: 78, signal: 88 },
  { id: 3, name: 'OBD2 Scanner - Car 3', type: 'OBD2', vehicle: 'Ford F-150', status: 'disconnected', battery: 12, signal: 0 },
  { id: 4, name: 'Telematics Unit - Car 4', type: 'Telematics', vehicle: 'Toyota Prius', status: 'connected', battery: 95, signal: 92 },
  { id: 5, name: 'OBD2 Scanner - Car 5', type: 'OBD2', vehicle: 'Honda Civic', status: 'connected', battery: 65, signal: 82 },
  { id: 6, name: 'GPS Tracker - Car 6', type: 'GPS', vehicle: 'BMW X5', status: 'inactive', battery: 4, signal: 0 },
]

export default function DevicesPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDevice, setSelectedDevice] = useState<typeof mockDevices[0] | null>(null)
  const [showDialog, setShowDialog] = useState(false)

  const filteredDevices = mockDevices.filter(
    (device) =>
      device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      device.vehicle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      device.type.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-emerald-500/10 text-emerald-700 border-emerald-200'
      case 'disconnected':
        return 'bg-red-500/10 text-red-700 border-red-200'
      case 'inactive':
        return 'bg-slate-500/10 text-slate-700 border-slate-200'
      default:
        return 'bg-slate-500/10 text-slate-700 border-slate-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <Wifi className="h-4 w-4" />
      case 'disconnected':
        return <WifiOff className="h-4 w-4" />
      case 'inactive':
        return <WifiOff className="h-4 w-4" />
      default:
        return null
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-foreground">Devices</h1>
          <p className="text-sm text-muted-foreground">Manage connected diagnostic and tracking devices</p>
        </div>
        <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          Add Device
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, vehicle, or type..."
          className="pl-10 bg-card border-border"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3 pt-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Devices</CardTitle>
            <Signal className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">{mockDevices.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3 pt-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Connected</CardTitle>
            <Wifi className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">{mockDevices.filter((d) => d.status === 'connected').length}</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3 pt-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Issues</CardTitle>
            <WifiOff className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">{mockDevices.filter((d) => d.status !== 'connected').length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="bg-secondary">
          <TabsTrigger value="all" className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            All Devices ({filteredDevices.length})
          </TabsTrigger>
          <TabsTrigger value="connected" className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Connected
          </TabsTrigger>
          <TabsTrigger value="issues" className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Issues
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <Card className="bg-card border-border">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-muted/50">
                  <TableHead className="text-foreground">Device Name</TableHead>
                  <TableHead className="text-foreground">Type</TableHead>
                  <TableHead className="text-foreground">Vehicle</TableHead>
                  <TableHead className="text-foreground">Battery</TableHead>
                  <TableHead className="text-foreground">Signal</TableHead>
                  <TableHead className="text-foreground">Status</TableHead>
                  <TableHead className="text-right text-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDevices.map((device) => (
                  <TableRow key={device.id} className="border-border hover:bg-muted/30 cursor-pointer transition-colors">
                    <TableCell className="font-medium text-foreground">{device.name}</TableCell>
                    <TableCell className="text-foreground">
                      <Badge variant="outline" className="bg-secondary text-foreground">
                        {device.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{device.vehicle}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Battery className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-foreground">{device.battery}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {device.signal > 0 && <Signal className="h-4 w-4 text-primary" />}
                        <span className="text-sm text-foreground">{device.signal}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`flex w-fit items-center gap-1 ${getStatusColor(device.status)}`}>
                        {getStatusIcon(device.status)}
                        {device.status.charAt(0).toUpperCase() + device.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedDevice(device)
                          setShowDialog(true)
                        }}
                        className="text-primary hover:text-primary hover:bg-primary/10"
                      >
                        Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="connected" className="mt-4">
          <Card className="bg-card border-border">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-muted/50">
                  <TableHead className="text-foreground">Device Name</TableHead>
                  <TableHead className="text-foreground">Type</TableHead>
                  <TableHead className="text-foreground">Vehicle</TableHead>
                  <TableHead className="text-foreground">Battery</TableHead>
                  <TableHead className="text-foreground">Signal</TableHead>
                  <TableHead className="text-right text-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDevices
                  .filter((device) => device.status === 'connected')
                  .map((device) => (
                    <TableRow key={device.id} className="border-border hover:bg-muted/30">
                      <TableCell className="font-medium text-foreground">{device.name}</TableCell>
                      <TableCell className="text-foreground">
                        <Badge variant="outline" className="bg-secondary text-foreground">
                          {device.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{device.vehicle}</TableCell>
                      <TableCell>{device.battery}%</TableCell>
                      <TableCell>{device.signal}%</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/10">
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="issues" className="mt-4">
          <Card className="bg-card border-border">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-muted/50">
                  <TableHead className="text-foreground">Device Name</TableHead>
                  <TableHead className="text-foreground">Type</TableHead>
                  <TableHead className="text-foreground">Vehicle</TableHead>
                  <TableHead className="text-foreground">Battery</TableHead>
                  <TableHead className="text-foreground">Status</TableHead>
                  <TableHead className="text-right text-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDevices
                  .filter((device) => device.status !== 'connected')
                  .map((device) => (
                    <TableRow key={device.id} className="border-border hover:bg-muted/30">
                      <TableCell className="font-medium text-foreground">{device.name}</TableCell>
                      <TableCell className="text-foreground">
                        <Badge variant="outline" className="bg-secondary text-foreground">
                          {device.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{device.vehicle}</TableCell>
                      <TableCell>{device.battery}%</TableCell>
                      <TableCell>
                        <Badge className={`flex w-fit items-center gap-1 ${getStatusColor(device.status)}`}>
                          {getStatusIcon(device.status)}
                          {device.status.charAt(0).toUpperCase() + device.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/10">
                          Details
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
        <DialogContent className="max-w-md bg-card border-border">
          {selectedDevice && (
            <>
              <DialogHeader>
                <DialogTitle className="text-foreground">{selectedDevice.name}</DialogTitle>
                <DialogDescription className="text-muted-foreground">Device configuration and status</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Type</span>
                  <span className="text-sm text-foreground">{selectedDevice.type}</span>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Vehicle</span>
                  <span className="text-sm text-foreground">{selectedDevice.vehicle}</span>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Status</span>
                  <Badge className={`w-fit flex items-center gap-1 ${getStatusColor(selectedDevice.status)}`}>
                    {getStatusIcon(selectedDevice.status)}
                    {selectedDevice.status.charAt(0).toUpperCase() + selectedDevice.status.slice(1)}
                  </Badge>
                </div>
                <div className="flex gap-4">
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">Battery</span>
                    <span className="text-sm font-medium text-foreground">{selectedDevice.battery}%</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">Signal</span>
                    <span className="text-sm font-medium text-foreground">{selectedDevice.signal}%</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button variant="outline" className="flex-1 border-border text-foreground hover:bg-muted">
                    Edit
                  </Button>
                  <Button variant="destructive" className="flex-1">
                    Deactivate
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
