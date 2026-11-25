/**
 * Mock people directory. Replace with the Employee API once the backend exists.
 * Every module's mock data is built from this list so names stay consistent across screens.
 */
export type Person = {
  id: string
  name: string
  email: string
  department: string
  designation: string
  location: string
  joined: string
  manager: string
  phone: string
  blood: string
}

const raw: [string, string, string, string, string][] = [
  // name, department, designation, location, joined
  ["Aarav Sharma", "Engineering", "Senior Software Engineer", "Bengaluru", "12 Mar 2023"],
  ["Priya Nair", "Human Resources", "HR Business Partner", "Bengaluru", "04 Jan 2022"],
  ["Rohan Mehta", "Engineering", "Engineering Manager", "Pune", "18 Jul 2021"],
  ["Ananya Iyer", "Design", "Product Designer", "Bengaluru", "02 Aug 2024"],
  ["Vikram Singh", "Sales", "Account Executive", "Gurugram", "21 Sep 2023"],
  ["Sneha Reddy", "Finance", "Finance Manager", "Hyderabad", "09 Feb 2020"],
  ["Karthik Rao", "Engineering", "DevOps Engineer", "Chennai", "15 Nov 2024"],
  ["Meera Joshi", "Marketing", "Marketing Lead", "Mumbai", "30 May 2022"],
  ["Arjun Patel", "Engineering", "Frontend Engineer", "Ahmedabad", "11 Oct 2025"],
  ["Divya Menon", "Customer Success", "CS Specialist", "Kochi", "07 Jun 2024"],
  ["Rahul Verma", "Sales", "Sales Manager", "Delhi", "19 Apr 2021"],
  ["Kavya Krishnan", "Engineering", "QA Engineer", "Bengaluru", "23 Jan 2025"],
  ["Nikhil Gupta", "IT", "IT Administrator", "Noida", "14 Dec 2022"],
  ["Ishita Bose", "Human Resources", "Talent Acquisition Lead", "Kolkata", "03 Mar 2023"],
  ["Siddharth Kulkarni", "Engineering", "Backend Engineer", "Pune", "28 Aug 2025"],
  ["Pooja Desai", "Finance", "Payroll Specialist", "Mumbai", "16 Sep 2021"],
  ["Aditya Chauhan", "Operations", "Operations Manager", "Jaipur", "05 Jul 2020"],
  ["Neha Kapoor", "Design", "UX Researcher", "Delhi", "12 Feb 2025"],
  ["Manish Tiwari", "Customer Success", "Support Engineer", "Lucknow", "20 Oct 2024"],
  ["Riya Banerjee", "Marketing", "Content Strategist", "Kolkata", "01 Apr 2025"],
  ["Harsh Malhotra", "Engineering", "Data Engineer", "Gurugram", "09 Sep 2025"],
  ["Tanvi Shetty", "Human Resources", "HR Executive", "Mangaluru", "25 Nov 2025"],
  ["Gaurav Saxena", "Operations", "Admin Executive", "Indore", "17 Jun 2023"],
  ["Lakshmi Pillai", "Engineering", "Mobile Engineer", "Thiruvananthapuram", "08 Oct 2025"],
]

const managers: Record<string, string> = {
  Engineering: "Rohan Mehta",
  "Human Resources": "Priya Nair",
  Design: "Rohan Mehta",
  Sales: "Rahul Verma",
  Finance: "Sneha Reddy",
  Marketing: "Meera Joshi",
  "Customer Success": "Aditya Chauhan",
  IT: "Aditya Chauhan",
  Operations: "Aditya Chauhan",
}

const bloods = ["O+", "B+", "A+", "AB+", "O-", "B-"]

export const PEOPLE: Person[] = raw.map(([name, department, designation, location, joined], i) => ({
  id: `PH${String(1001 + i)}`,
  name,
  email: `${name.toLowerCase().replace(/\s+/g, ".")}@tapmind.com`,
  department,
  designation,
  location,
  joined,
  manager: managers[department] === name ? "Aditya Chauhan" : managers[department],
  phone: `+91 98${String(45000000 + i * 137911).slice(0, 8)}`,
  blood: bloods[i % bloods.length],
}))

/** The signed-in demo user (used for the Employee view). */
export const ME = PEOPLE[0]

export const DEPARTMENTS = Array.from(new Set(PEOPLE.map((p) => p.department)))

export function person(name: string) {
  return PEOPLE.find((p) => p.name === name) ?? PEOPLE[0]
}

/** Pick n people starting at offset, always including ME first when `withMe` is set. */
export function pick(n: number, offset = 0, withMe = true) {
  const pool = PEOPLE.slice(1)
  const list = Array.from({ length: withMe ? n - 1 : n }, (_, i) => pool[(offset + i) % pool.length])
  return withMe ? [ME, ...list] : list
}

/** Cycle through a list of values deterministically. */
export function cycle<T>(values: T[], i: number): T {
  return values[i % values.length]
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

/** Stable avatar tint per person, drawn from the chart palette. */
export function tint(name: string) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 997
  return ["bg-brand-600", "bg-ink-800", "bg-amber-500", "bg-emerald-600", "bg-sky-600"][h % 5]
}
