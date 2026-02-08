import { Menu, Sun, Moon, Bell, User } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

export default function Header({ onMenuClick }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header 
      className="sticky top-0 z-30 h-16 bg-background/95 backdrop-blur border-b border-border"
      data-testid="app-header"
    >
      <div className="flex items-center justify-between h-full px-4 md:px-6">
        {/* Left Side */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onMenuClick}
            data-testid="menu-toggle-btn"
          >
            <Menu className="w-5 h-5" />
          </Button>
          
          <div className="hidden md:block">
            <h1 className="font-heading font-semibold text-foreground">
              MUL Salary Tracker
            </h1>
            <p className="text-xs text-muted-foreground">
              Manage your work hours and payslips
            </p>
          </div>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            data-testid="theme-toggle-btn"
          >
            {theme === 'light' ? (
              <Moon className="w-5 h-5" />
            ) : (
              <Sun className="w-5 h-5" />
            )}
          </Button>

          {/* Notifications */}
          <Button variant="ghost" size="icon" data-testid="notifications-btn">
            <Bell className="w-5 h-5" />
          </Button>

          {/* Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="relative h-9 w-9 rounded-full"
                data-testid="profile-dropdown-trigger"
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src="https://images.unsplash.com/photo-1603252112050-5ee77b4b4fde?crop=entropy&cs=srgb&fm=jpg&w=100" />
                  <AvatarFallback>
                    <User className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">Employee</p>
                  <p className="text-xs text-muted-foreground">
                    employee@company.com
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem data-testid="profile-settings-item">
                Profile Settings
              </DropdownMenuItem>
              <DropdownMenuItem data-testid="help-item">
                Help & Support
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600" data-testid="logout-item">
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
