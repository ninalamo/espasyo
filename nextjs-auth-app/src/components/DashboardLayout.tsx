'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect, useRef, ReactNode } from 'react';
import {
  Home,
  FileText,
  BarChart3,
  TrendingUp,
  MapPin,
  User,
  ChevronDown,
  Menu,
  X,
  LogOut
} from 'lucide-react';
import Link from 'next/link';

interface DashboardLayoutProps {
  children: ReactNode;
}

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

interface NavigationDropdown {
  name: string;
  items: NavigationItem[];
}

interface NavigationGroup {
  type: 'single' | 'dropdown';
  item?: NavigationItem;
  dropdown?: NavigationDropdown;
}

const navigationGroups: NavigationGroup[] = [
  {
    type: 'single',
    item: {
      name: 'Home',
      href: '/',
      icon: Home,
      description: 'Dashboard overview'
    }
  },
  {
    type: 'dropdown',
    dropdown: {
      name: 'Records',
      items: [
        {
          name: 'Criminal',
          href: '/crime-record',
          icon: FileText,
          description: 'Manage crime incidents'
        },
        {
          name: 'Precinct',
          href: '/precincts',
          icon: MapPin,
          description: 'Manage precinct details'
        }
      ]
    }
  },
  {
    type: 'single',
    item: {
      name: 'Analysis',
      href: '/analysis',
      icon: BarChart3,
      description: 'Crime pattern analysis'
    }
  },
  {
    type: 'single',
    item: {
      name: 'Forecast',
      href: '/forecast',
      icon: TrendingUp,
      description: 'Predictive forecasting'
    }
  },

];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [dropdownStates, setDropdownStates] = useState<Record<string, boolean>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const toggleDropdown = (dropdownName: string) => {
    setDropdownStates(prev => ({
      ...prev,
      [dropdownName]: !prev[dropdownName]
    }));
  };

  // Close user dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsUserDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-collapse sidebar on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    
    // Set initial state
    handleResize();
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSignOut = () => {
    signOut();
    setIsUserDropdownOpen(false);
  };

  const getCurrentPageInfo = () => {
    // Find current page info from navigation groups
    for (const group of navigationGroups) {
      if (group.type === 'single' && group.item && group.item.href === pathname) {
        return group.item;
      } else if (group.type === 'dropdown' && group.dropdown) {
        const foundItem = group.dropdown.items.find(item => item.href === pathname);
        if (foundItem) {
          return foundItem;
        }
      }
    }
    return { name: 'Dashboard', description: 'Welcome to ESPASYO' };
  };

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 overflow-hidden bg-white shadow-lg flex flex-col`}>
        {/* Sidebar Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">ESPASYO</h1>
              <p className="text-sm text-gray-500">Crime Analysis Platform</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navigationGroups.map((group, index) => {
            if (group.type === 'single' && group.item) {
              const item = group.item;
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-4 py-3 rounded-lg transition-colors group ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-blue-700' : 'text-gray-500'}`} />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{item.name}</div>
                    <div className="text-xs text-gray-500">{item.description}</div>
                  </div>
                </Link>
              );
            } else if (group.type === 'dropdown' && group.dropdown) {
              const dropdown = group.dropdown;
              const isAnyChildActive = dropdown.items.some(item => pathname === item.href);
              const isOpen = dropdownStates[dropdown.name] || false;
              
              return (
                <div key={dropdown.name} className="space-y-1">
                  <button
                    onClick={() => toggleDropdown(dropdown.name)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                      isAnyChildActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <div className="flex items-center">
                      <FileText className={`w-5 h-5 mr-3 ${isAnyChildActive ? 'text-blue-700' : 'text-gray-500'}`} />
                      <div className="text-left">
                        <div className="text-sm font-medium">{dropdown.name}</div>
                        <div className="text-xs text-gray-500">Manage records</div>
                      </div>
                    </div>
                    <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {isOpen && (
                    <div className="ml-8 space-y-1">
                      {dropdown.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;
                        
                        return (
                          <Link
                            key={item.name}
                            href={item.href}
                            className={`flex items-center px-4 py-2 rounded-lg transition-colors text-sm ${
                              isActive
                                ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            }`}
                          >
                            <Icon className={`w-4 h-4 mr-3 ${isActive ? 'text-blue-700' : 'text-gray-400'}`} />
                            <div>
                              <div className="font-medium">{item.name}</div>
                              <div className="text-xs text-gray-500">{item.description}</div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            return null;
          })}
        </nav>

        {/* User Profile Section */}
        {session && (
          <div className="border-t border-gray-200 p-4">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                className="w-full flex items-center px-4 py-3 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                  <User className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium text-gray-900">
                    {session.user?.name || 'User'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {session.user?.email}
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </button>

              {/* User Dropdown */}
              {isUserDropdownOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2">
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center px-4 py-2 text-left text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <LogOut className="w-4 h-4 mr-3" />
                    <span className="text-sm">Sign out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
              >
                {isSidebarOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>
              
              <div className="ml-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  {getCurrentPageInfo().name}
                </h2>
                <p className="text-sm text-gray-500">
                  {getCurrentPageInfo().description}
                </p>
              </div>
            </div>

            {/* Quick Actions or Additional Controls */}
            <div className="flex items-center space-x-2">
              {/* Add any quick action buttons here */}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="h-full">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}