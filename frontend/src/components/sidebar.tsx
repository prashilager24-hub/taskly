import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui";
import { Link, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  ShieldCheck,
  Users,
  Building2,
  Target,
  Goal,
  Briefcase,
  BarChart3,
  CheckCircle2,
  Settings,
  LifeBuoy,
} from "lucide-react";
// Custom Icons



const XIcon = (props: any) => (
  <svg
    aria-hidden="true"
    fill="none"
    focusable="false"
    height="1em"
    role="presentation"
    viewBox="0 0 24 24"
    width="1em"
    {...props}
  >
    <path
      d="M18 6L6 18M6 6l12 12"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    />
  </svg>
);
const ChevronDownIcon = (props: any) => (
  <svg aria-hidden="true" fill="none" focusable="false" height="1em" role="presentation" viewBox="0 0 24 24" width="1em" {...props}>
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  </svg>
);
// Sidebar Component

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  currentPage?: string;
}

interface MenuItem {
  icon: any;
  label: string;
  href: string;
  module: string;
  adminOnly?: boolean;
  departments?: number[];
  children?: MenuItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  toggleSidebar,
  currentPage = "/",
}) => {
  const [authUserLD, setauthUserLD] = useState<any>(null);
  const [rolePermissions, setRolePermissions] = useState<any>({});
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  const [currentNews, setCurrentNews] = useState(0);

  const newsItems = [
    {
      title: "Please Get your Q3 reviews done last date is october 8th",
      time: "2026-10-06T12:25:00",
    },
  ];

  const getRelativeTime = (timestamp: string) => {
    const now = new Date();
    const createdAt = new Date(timestamp);

    const diffMs = now.getTime() - createdAt.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 1) return "just now";

    if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes !== 1 ? "s" : ""} ago`;
    }

    const diffHours = Math.floor(diffMinutes / 60);

    if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
    }

    const diffDays = Math.floor(diffHours / 24);

    return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
  };
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentNews((prev) => (prev + 1) % newsItems.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [newsItems.length]);

  const [, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000); // update every minute

    return () => clearInterval(timer);
  }, []);
  // const toggleMenu = (label: string) => {
  //   console.log("Toggling menu:", label);
  //   console.log("Currently expanded menus:", expandedMenus);
  //   setExpandedMenus(prev =>
  //     prev.includes(label)
  //       ? prev.filter(item => item !== label)
  //       : [...prev, label]
  //   );
  //   console.log("Updated expanded menus:", expandedMenus);
  // };
  const toggleMenu = (label: string) => {
    setExpandedMenus(prev =>
      prev.includes(label) ? [] : [label]
    );
  };


  // Load user when component mounts
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("authUserLD");
      if (storedUser) {
        setauthUserLD(JSON.parse(storedUser));
      }

      const storedRole = localStorage.getItem("roles");
      if (storedRole) {
        const parsedRole = JSON.parse(storedRole);
        setRolePermissions(
          JSON.parse(parsedRole.rolePrivileges || "{}")
        );
      }
    } catch (e) {
      console.error("Failed to parse auth data from localStorage:", e);
    }
  }, []);

  // Sync with changes from other tabs or after login/logout
  useEffect(() => {
    const handleStorageChange = () => {
      const storedUser = localStorage.getItem("authUserLD");
      setauthUserLD(storedUser ? JSON.parse(storedUser) : null);
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);
  const navigate = useNavigate();
  const hasAccess = (
    module: string,
    permission: string = "read"
  ) => {
    return rolePermissions?.[module]?.includes(permission);
  };

  // Define menu items
  const menuItems: MenuItem[] = [
    {
      icon: LayoutDashboard,
      label: "Dashboard",
      href: "dashboard",
      module: "dashboard"
    },

    {
      icon: ClipboardList,
      label: "Daily Activity",
      href: "daily-activity",
      module: "dataentry"
    },

    {
      icon: BarChart3,
      label: "Reports",
      href: "reports",
      module: "reports",
      children: [
        {
          icon: FileText,
          label: "Performance Insights",
          href: "efficiency-report",
          module: "perf"
        },
        {
          icon: Users,
          label: "User Data",
          href: "daily-log",
          module: "mydata"
        },
        {
          icon: Goal,
          label: "Goals Achieved",
          href: "goals",
          module: "goals"
        },
        {
          icon: CheckCircle2,
          label: "Entry Approval",
          href: "entry-approval",
          module: "entryApproval"
        },
        {
          icon: CheckCircle2,
          label: "User History",
          href: "user-history",
          module: "userHistory"
        },
        {
          icon: CheckCircle2,
          label: "Query Report",
          href: "query-report",
          module: "queryReport"
        },

      ]
    },

    {
      icon: Briefcase,
      label: "Sales Forward",
      href: "sales-forward",
      module: "salesfwd",
      departments: [21]
    },

    {
      icon: Settings,
      label: "Admin",
      href: "admin",
      module: "admin",
      children: [
        {
          icon: ShieldCheck,
          label: "Access Management",
          href: "access-management",
          module: "accessmgmt"
        },
        {
          icon: Building2,
          label: "Department Management",
          href: "primaryDepartment",
          module: "deptmgmt"
        },

        {
          icon: Building2,
          label: "Sub Department Management",
          href: "department",
          module: "deptmgmt"
        },
        {
          icon: ClipboardList,
          label: "Task Management",
          href: "tasks",
          module: "taskmgmt"
        },
        {
          icon: Target,
          label: "Target Management",
          href: "target",
          module: "targetmgmt"
        },
        {
          icon: Goal,
          label: "Goal Management",
          href: "Goal-management",
          module: "goalmgmt"
        }
      ]
    },

    // Support (formerly HR Feedback); PMS now lives on the Dashboard as a tab
    {
      icon: LifeBuoy,
      label: "Support",
      href: "support",
      module: "hrfeedback",
      children: [
        { icon: ClipboardList, label: "Onboarding Experience", href: "support/onboarding", module: "hrfeedback" },
        { icon: ClipboardList, label: "Query & HR", href: "support/query", module: "hrfeedback" },
        { icon: ClipboardList, label: "Employee Engagement", href: "support/engagement", module: "hrfeedback" },
      ]
    }
  ];

  // Filter based on user role
  const filteredMenu = useMemo(() => menuItems
    .map((item) => {
      if (item.children) {
        const filteredChildren = item.children.filter((child) => {
          if (child.adminOnly) return authUserLD?.userRole === 1;
          if (child.module === "hrfeedback") return true; // Support is open to every user
          return hasAccess(child.module);
        });
        return { ...item, children: filteredChildren };
      }
      return item;
    })
    .filter((item) => {
      if (item.adminOnly) return authUserLD?.userRole === 1;
      if (item.module === "hrfeedback") return true;
      if (item.departments?.length) {
        const hasDeptAccess = item.departments.includes(
          Number(authUserLD?.departmentID)
        );
        if (!hasDeptAccess) return false;
      }
      if (hasAccess(item.module)) return true;
      if (item.children?.length) return true;
      return false;
    }), [authUserLD, rolePermissions]);

  const activePage = useMemo(() => currentPage.replaceAll("/", ""), [currentPage]);
  const isActiveHref = (href: string) => activePage === href.split("/").join("");

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 xl:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 bg-white dark:bg-gray-900 shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        style={{ height: "100%", minWidth: "16rem" }}
      >
        <div className="flex items-center gap-2 px-4 py-4 justify-center cursor-pointer" onClick={() => {
          navigate("/dashboard")
        }}>
          <img src="/Tapmind.ico" alt="Taskly Logo" /><h2 className="text-3xl font-bold">TASKLY</h2>
          <Button
            isIconOnly
            variant="light"
            onClick={toggleSidebar}
            className="lg:hidden"
          >
            <XIcon />
          </Button>
        </div>

        <nav className="mt-8">
          <ul className="space-y-2 px-4" style={{ fontSize: "12px" }}>
            {filteredMenu.map((item) => {
              const isActive = isActiveHref(item.href);
              const isExpanded = expandedMenus.includes(item.label);
              const hasChildren = item.children && item.children.length > 0;

              return (
                <li key={item.label}>
                  {hasChildren ? (
                    <>
                      {/* Parent menu */}
                      <button
                        onClick={() => {
                          toggleMenu(item.label)
                        }}

                        className={`flex items-center justify-between w-full px-4 py-2 rounded-lg transition-colors
    ${isExpanded || item.children?.some(c => isActiveHref(c.href))
                            ? "bg-orange-50 text-orange-600"
                            : "text-gray-700 hover:bg-gray-100"
                          }`}
                      >
                        <div className="flex items-center">
                          <item.icon className="w-5 h-5 mr-3" />
                          {item.label}
                        </div>
                        <ChevronDownIcon
                          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      </button>

                      {/* Children menus */}
                      {isExpanded && (
                        <ul className="mt-1 ml-8 space-y-1">
                          {item.children.map((child) => {
                            const isChildActive = isActiveHref(child.href);
                            return (
                              <li key={child.label} style={{ fontSize: "12px" }} onClick={() => {
                                toggleSidebar();
                              }}>
                                <Link
                                  to={`/${child.href}`}
                                  className={`flex items-center px-4 py-2 rounded-lg  transition-colors ${isChildActive
                                    ? "bg-orange-50 text-orange-600"
                                    : "text-gray-600 hover:bg-gray-50"
                                    }`}
                                >
                                  {child.label}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </>
                  ) : (
                    // Regular menu item without children
                    <Link
                      to={`/${item.href}`}
                      onClick={() => {
                        setExpandedMenus([])
                        toggleSidebar();
                      }}
                      className={`flex items-center px-4 py-2 rounded-lg transition-colors ${isActive
                        ? "bg-orange-50 text-orange-600"
                        : "text-gray-700 hover:bg-gray-100"
                        }`}
                    >
                      <item.icon className="w-5 h-5 mr-3" />
                      {item.label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Newsletter Section */}
        <div className="absolute bottom-0 left-0 right-0 p-3 ">
          <div className="bg-primary/10 rounded-xl p-4 border border-primary/20">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <h3 className="text-xs font-bold text-primary uppercase">
                Announcements
              </h3>
            </div>
            <div className="h-[80px] flex items-center overflow-hidden">
              <div
                key={currentNews}
                className="w-full p-2.5 rounded-lg bg-white/80 shadow-sm animate-slideUp"
              >
                <p className="text-xs font-medium text-gray-800 line-clamp-4">
                  {newsItems[currentNews].title}
                </p>
                <p className="text-[10px] text-primary mt-1 font-medium">
                  {getRelativeTime(newsItems[currentNews].time)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
