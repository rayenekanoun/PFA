'use client'

import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarFooter, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarSeparator, SidebarInset } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { BarChart3, Car, Radio, MessageSquare, FileText, LogOut, Settings } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const mainNavItems = [
  { href: '/overview', label: 'Overview', icon: BarChart3 },
  { href: '/cars', label: 'Cars', icon: Car },
  { href: '/devices', label: 'Devices', icon: Radio },
  { href: '/conversations', label: 'Conversations', icon: MessageSquare },
  { href: '/reports', label: 'Reports', icon: FileText },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  const isActive = (href: string) => pathname === href

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="border-b border-sidebar-border">
          <div className="flex items-center gap-2 px-2 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground text-sm font-bold">
              DH
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-sidebar-foreground">DiagHub</span>
              <span className="text-xs text-sidebar-foreground/60">Diagnostics</span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarMenu>
            {mainNavItems.map((item) => {
              const Icon = item.icon
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    className="text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
                  >
                    <Link href={item.href}>
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter>
          <SidebarSeparator />
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild className="text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent">
                <Link href="/settings">
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent">
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </Button>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="overflow-hidden">
        <div className="flex h-full flex-col bg-background">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
