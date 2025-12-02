"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Link as LinkIcon,
  LogOut,
  Settings,
  User,
  Menu,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

export function Header() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Logged out successfully");
      setMobileMenuOpen(false);
      router.push("/");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to logout");
    }
  };

  return (
    <header className="bg-gradient-to-r from-blue-600 to-blue-700 shadow-lg border-b-4 border-blue-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <Link
            href="/"
            className="flex items-center gap-2 hover:opacity-90 transition-opacity cursor-pointer"
          >
            <div className="bg-white rounded-lg p-2 shadow-md">
              <LinkIcon className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-xl font-bold text-white hidden sm:inline">
              URL Shortener
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="/"
              className="text-white hover:text-blue-100 font-medium cursor-pointer transition-colors duration-150"
            >
              Home
            </Link>
            {isAuthenticated && (
              <>
                <Link
                  href="/dashboard"
                  className="text-white hover:text-blue-100 font-medium cursor-pointer transition-colors duration-150"
                >
                  Dashboard
                </Link>
                <Link
                  href="/profile"
                  className="text-white hover:text-blue-100 font-medium cursor-pointer transition-colors duration-150"
                >
                  Profile
                </Link>
                <Link
                  href="/settings"
                  className="text-white hover:text-blue-100 font-medium cursor-pointer transition-colors duration-150"
                >
                  Settings
                </Link>
              </>
            )}
          </nav>

          {/* Right Side - Desktop */}
          <div className="hidden md:flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <div className="text-sm text-blue-100 bg-blue-500 px-3 py-1 rounded-full">
                  {user?.name || user?.email}
                </div>
                <div className="flex gap-2">
                  <Link href="/profile">
                    <Button
                      variant="outline"
                      size="sm"
                      className="cursor-pointer bg-white hover:bg-blue-50 text-blue-600 border-white"
                    >
                      <User className="w-4 h-4 mr-1" />
                      Profile
                    </Button>
                  </Link>
                  <Link href="/settings">
                    <Button
                      variant="outline"
                      size="sm"
                      className="cursor-pointer bg-white hover:bg-blue-50 text-blue-600 border-white"
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Button
                    onClick={handleLogout}
                    className="cursor-pointer bg-red-500 hover:bg-red-600 text-white border-none"
                    size="sm"
                  >
                    <LogOut className="w-4 h-4 mr-1" />
                    Logout
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex gap-2">
                <Link href="/auth/login">
                  <Button
                    variant="outline"
                    size="sm"
                    className="cursor-pointer bg-white hover:bg-blue-50 text-blue-600 border-white font-medium"
                  >
                    Login
                  </Button>
                </Link>
                <Link href="/auth/register">
                  <Button
                    size="sm"
                    className="cursor-pointer bg-blue-500 hover:bg-blue-400 text-white border-none font-medium"
                  >
                    Sign Up
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-white cursor-pointer p-2 hover:bg-blue-500 rounded-lg transition-colors"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 space-y-2 border-t border-blue-500">
            <Link href="/" className="block">
              <Button
                className="w-full justify-start cursor-pointer bg-blue-500 hover:bg-blue-400 text-white border-none"
                size="sm"
                onClick={() => setMobileMenuOpen(false)}
              >
                Home
              </Button>
            </Link>
            {isAuthenticated && (
              <>
                <Link href="/dashboard" className="block">
                  <Button
                    className="w-full justify-start cursor-pointer bg-blue-500 hover:bg-blue-400 text-white border-none"
                    size="sm"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Dashboard
                  </Button>
                </Link>
                <Link href="/profile" className="block">
                  <Button
                    className="w-full justify-start cursor-pointer bg-blue-500 hover:bg-blue-400 text-white border-none"
                    size="sm"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <User className="w-4 h-4 mr-2" />
                    Profile
                  </Button>
                </Link>
                <Link href="/settings" className="block">
                  <Button
                    className="w-full justify-start cursor-pointer bg-blue-500 hover:bg-blue-400 text-white border-none"
                    size="sm"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </Button>
                </Link>
                <Button
                  onClick={handleLogout}
                  className="w-full justify-start cursor-pointer bg-red-500 hover:bg-red-600 text-white border-none"
                  size="sm"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </>
            )}
            {!isAuthenticated && (
              <>
                <Link href="/auth/login" className="block">
                  <Button
                    variant="outline"
                    className="w-full cursor-pointer bg-white hover:bg-blue-50 text-blue-600 border-white font-medium"
                    size="sm"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Login
                  </Button>
                </Link>
                <Link href="/auth/register" className="block">
                  <Button
                    className="w-full cursor-pointer bg-blue-400 hover:bg-blue-300 text-white border-none font-medium"
                    size="sm"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Sign Up
                  </Button>
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;
