import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Menu, X, MessageSquare, ChevronDown } from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ThemeToggle from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "@/firebase";
import { getUserRole, roleDefaultDashboardPath, setUserRole } from "@/auth/role";

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userUid, setUserUid] = useState<string | null>(null);
  const [userRole, setUserRoleState] = useState<string | null>(null);
  const [userPhotoUrl, setUserPhotoUrl] = useState<string | null>(null);
  const [userUsername, setUserUsername] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUserEmail(u?.email ?? null);
      setUserUid(u?.uid ?? null);
      setUserRoleState(u?.uid ? getUserRole(u.uid) : null);
      setUserPhotoUrl(u?.photoURL ?? null);
    });
    const onProfileUpdated = () => {
      const u = auth.currentUser;
      setUserEmail(u?.email ?? null);
      setUserUid(u?.uid ?? null);
      setUserRoleState(u?.uid ? getUserRole(u.uid) : null);
      setUserPhotoUrl(u?.photoURL ?? null);
    };
    window.addEventListener("profile-updated", onProfileUpdated);
    return () => {
      window.removeEventListener("profile-updated", onProfileUpdated);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userUid) {
      setUserUsername(null);
      return undefined;
    }

    const unsub = onSnapshot(
      doc(db, "users", userUid),
      (snap) => {
        const data = snap.data() || {};
        setUserUsername(data.username || data.usernameLower || null);
      },
      () => {
        setUserUsername(null);
      },
    );

    return unsub;
  }, [userUid]);

  const showBecomeSeller = userRole !== "freelancer";

  const handleSwitchRole = (nextRole: "client" | "freelancer") => {
    if (!userUid) return;
    setUserRole(userUid, nextRole);
    setUserRoleState(nextRole);
    navigate(roleDefaultDashboardPath(nextRole));
    setIsMenuOpen(false);
  };

  const avatarInitials = useMemo(() => {
    const label = userUsername || userEmail;
    if (!label) return "U";
    const s = String(label).replace(/^@/, "").trim();
    return (s.slice(0, 1) || "U").toUpperCase();
  }, [userEmail, userUsername]);

  const accountLabel = useMemo(() => {
    return userUsername ? `@${userUsername}` : "Account";
  }, [userUsername]);

  const categories = [
    "Graphics & Design",
    "Digital Marketing",
    "Writing & Translation",
    "Video & Animation",
    "Programming & Tech",
    "Business",
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/gigs?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  const hideGlobalSearch = location.pathname.startsWith("/messages");

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-sm">
      <nav className="container mx-auto px-4">
        {/* Main Navbar */}
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="h-8 w-8 rounded-full bg-black p-1 ring-1 ring-black/10">
              <img
                src="/LOGO.png"
                alt="GigFlow logo"
                className="h-full w-full object-contain"
              />
            </div>
            <span className="text-xl font-bold text-foreground hidden sm:block">
              GigFlow
            </span>
          </Link>

          {/* Search Bar - Desktop */}
          {!hideGlobalSearch ? (
            <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-xl mx-8">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search for any service..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 h-10 bg-surface border-border focus:border-primary"
                />
              </div>
            </form>
          ) : (
            <div className="hidden md:block flex-1" />
          )}

          {/* Right Side Actions */}
          <div className="flex items-center gap-2">
            <ThemeToggle />

            {/* Messages (top-right) */}
            {userEmail ? (
              <Button variant="ghost" size="icon" asChild className="hidden sm:inline-flex">
                <Link to="/messages" aria-label="Messages">
                  <MessageSquare className="h-5 w-5" />
                </Link>
              </Button>
            ) : null}

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-1">
                    Explore
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {categories.map((category) => (
                    <DropdownMenuItem key={category} asChild>
                      <Link to={`/gigs?category=${encodeURIComponent(category)}`}>
                        {category}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant="ghost" asChild>
                <Link to="/refunds">Refund Policy</Link>
              </Button>

              {showBecomeSeller ? (
                <Button variant="ghost" asChild>
                  <Link to="/register?role=freelancer">Become a Seller</Link>
                </Button>
              ) : null}
            </div>

            {/* Account (top-right) */}
            <div className="hidden sm:flex items-center gap-2">
              {userEmail ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="gap-2">
                      <Avatar className="h-7 w-7">
                        {userPhotoUrl ? <AvatarImage src={userPhotoUrl} alt="Profile photo" /> : null}
                        <AvatarFallback>{avatarInitials}</AvatarFallback>
                      </Avatar>
                      <span className="max-w-[200px] truncate">{accountLabel}</span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      {userRole ? `Role: ${userRole}` : "Role: client"}
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/dashboard">Client Dashboard</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/job-post">Post a Job</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/job-posts">Job Posts</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() =>
                        handleSwitchRole(userRole === "freelancer" ? "client" : "freelancer")
                      }
                      className="cursor-pointer"
                    >
                      {userRole === "freelancer"
                        ? "Switch to client dashboard"
                        : "Switch to freelancer dashboard"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/account">Account</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => signOut(auth)}
                      className="cursor-pointer"
                    >
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <>
                  <Button variant="ghost" asChild>
                    <Link to="/login">Sign In</Link>
                  </Button>
                  <Button variant="hero" asChild>
                    <Link to="/register">Join</Link>
                  </Button>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Categories Bar - Desktop */}
        <div className="hidden lg:flex items-center gap-6 py-2 border-t border-border/50 text-sm">
          {categories.map((category) => (
            <Link
              key={category}
              to={`/gigs?category=${encodeURIComponent(category)}`}
              className="text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
            >
              {category}
            </Link>
          ))}
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden border-t border-border bg-background max-h-[calc(100vh-4rem)] overflow-y-auto"
          >
            <div className="container mx-auto px-4 py-4 space-y-4">
              {/* Mobile Search */}
              {!hideGlobalSearch ? (
                <form onSubmit={handleSearch} className="md:hidden">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search for any service..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10"
                    />
                  </div>
                </form>
              ) : null}

              {/* Mobile Categories */}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">
                  Categories
                </p>
                {categories.map((category) => (
                  <Link
                    key={category}
                    to={`/gigs?category=${encodeURIComponent(category)}`}
                    className="block px-2 py-2 text-foreground hover:bg-muted rounded-lg transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {category}
                  </Link>
                ))}
              </div>

              {/* Mobile Legal */}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">
                  Legal
                </p>
                <Link
                  to="/refunds"
                  className="block px-2 py-2 text-foreground hover:bg-muted rounded-lg transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Refund Policy
                </Link>
              </div>

              {/* Mobile Auth Buttons */}
              <div className="flex flex-col gap-2 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">
                    Theme
                  </div>
                  <ThemeToggle />
                </div>

                {userEmail ? (
                  <>
                    <Button variant="outline" asChild className="w-full">
                      <Link to="/dashboard" onClick={() => setIsMenuOpen(false)}>
                        Client Dashboard
                      </Link>
                    </Button>
                    <Button variant="outline" asChild className="w-full">
                      <Link to="/job-post" onClick={() => setIsMenuOpen(false)}>
                        Post a Job
                      </Link>
                    </Button>
                    <Button variant="outline" asChild className="w-full">
                      <Link to="/job-posts" onClick={() => setIsMenuOpen(false)}>
                        Job Posts
                      </Link>
                    </Button>
                    <Button variant="outline" asChild className="w-full">
                      <Link to="/messages" onClick={() => setIsMenuOpen(false)}>
                        Messages
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() =>
                        handleSwitchRole(userRole === "freelancer" ? "client" : "freelancer")
                      }
                      type="button"
                    >
                      {userRole === "freelancer"
                        ? "Switch to client dashboard"
                        : "Switch to freelancer dashboard"}
                    </Button>
                    <Button variant="outline" asChild className="w-full">
                      <Link to="/account" onClick={() => setIsMenuOpen(false)}>
                        Account
                      </Link>
                    </Button>
                    <Button
                      variant="hero"
                      className="w-full"
                      onClick={() => {
                        void signOut(auth);
                        setIsMenuOpen(false);
                      }}
                      type="button"
                    >
                      Sign out
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" asChild className="w-full">
                      <Link to="/login" onClick={() => setIsMenuOpen(false)}>
                        Sign In
                      </Link>
                    </Button>
                    <Button variant="hero" asChild className="w-full">
                      <Link to="/register" onClick={() => setIsMenuOpen(false)}>
                        Join GigFlow
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Navbar;