"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Download, Search, Loader2, ExternalLink, Filter, X } from "lucide-react"
import { getAccessibilityResults, exportToExcel } from "@/lib/actions"
import { toast } from "@/components/ui/use-toast"
import type { AccessibilityResult, AccessibilitySummary } from "@/lib/types"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ResultsTable() {
  const [results, setResults] = useState<AccessibilityResult[]>([])
  const [summary, setSummary] = useState<AccessibilitySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [sortBy, setSortBy] = useState("severity")
  const [searchQuery, setSearchQuery] = useState("")
  
  // Add filters state
  const [severityFilters, setSeverityFilters] = useState<string[]>([])
  const [complianceFilters, setComplianceFilters] = useState<string[]>([])

  const fetchResults = async () => {
    setLoading(true)
    try {
      const data = await getAccessibilityResults({
        page,
        pageSize,
        sortBy,
        search: searchQuery,
        severityFilters,
        complianceFilters,
      })

      setResults(data.results)
      setSummary(data.summary)
      setTotalPages(Math.ceil(data.total / pageSize))
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch accessibility results",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchResults()
  }, [page, sortBy, searchQuery, severityFilters, complianceFilters])

  const handleExport = async () => {
    setExporting(true)
    try {
      // Update to use the API route for download
      window.location.href = '/api/export'
      
      toast({
        title: "Success",
        description: "Results exported to Excel successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to export results to Excel",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical":
        return "bg-red-500 hover:bg-red-600"
      case "serious":
        return "bg-orange-500 hover:bg-orange-600"
      case "moderate":
        return "bg-yellow-500 hover:bg-yellow-600"
      case "minor":
        return "bg-blue-500 hover:bg-blue-600"
      default:
        return "bg-gray-500 hover:bg-gray-600"
    }
  }

  const getTagColor = (tag: string) => {
    if (tag.includes("wcag2aaa")) {
      return "bg-purple-500 hover:bg-purple-600"
    } else if (tag.includes("wcag2aa")) {
      return "bg-green-500 hover:bg-green-600"
    } else if (tag.includes("wcag2a")) {
      return "bg-blue-500 hover:bg-blue-600"
    } else if (tag.includes("section508")) {
      return "bg-orange-500 hover:bg-orange-600"
    } else if (tag.includes("best-practice")) {
      return "bg-teal-500 hover:bg-teal-600"
    } else if (tag.includes("experimental")) {
      return "bg-gray-500 hover:bg-gray-600"
    }
    return "bg-gray-500 hover:bg-gray-600"
  }

  // Handle severity filter toggle
  const toggleSeverityFilter = (severity: string) => {
    setSeverityFilters(prev => 
      prev.includes(severity) 
        ? prev.filter(s => s !== severity)
        : [...prev, severity]
    )
    setPage(1) // Reset to first page on filter change
  }

  // Handle compliance filter toggle
  const toggleComplianceFilter = (compliance: string) => {
    setComplianceFilters(prev => 
      prev.includes(compliance) 
        ? prev.filter(c => c !== compliance)
        : [...prev, compliance]
    )
    setPage(1) // Reset to first page on filter change
  }

  // Clear all filters
  const clearFilters = () => {
    setSeverityFilters([])
    setComplianceFilters([])
  }

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-red-100 p-4 rounded-lg">
            <div className="text-sm text-gray-500">Critical</div>
            <div className="text-2xl font-bold text-black">{summary.critical}</div>
          </div>
          <div className="bg-orange-100 p-4 rounded-lg">
            <div className="text-sm text-gray-500">Serious</div>
            <div className="text-2xl font-bold text-black">{summary.serious}</div>
          </div>
          <div className="bg-yellow-100 p-4 rounded-lg">
            <div className="text-sm text-gray-500">Moderate</div>
            <div className="text-2xl font-bold text-black">{summary.moderate}</div>
          </div>
          <div className="bg-blue-100 p-4 rounded-lg">
            <div className="text-sm text-gray-500">Minor</div>
            <div className="text-2xl font-bold text-black">{summary.minor}</div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search issues..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        {/* Severity Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full sm:w-auto">
              <Filter className="mr-2 h-4 w-4" />
              Severity
              {severityFilters.length > 0 && (
                <Badge className="ml-2 bg-primary" variant="secondary">
                  {severityFilters.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[200px]">
            <DropdownMenuLabel>Filter by Severity</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={severityFilters.includes("critical")}
              onCheckedChange={() => toggleSeverityFilter("critical")}
            >
              Critical
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={severityFilters.includes("serious")}
              onCheckedChange={() => toggleSeverityFilter("serious")}
            >
              Serious
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={severityFilters.includes("moderate")}
              onCheckedChange={() => toggleSeverityFilter("moderate")}
            >
              Moderate
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={severityFilters.includes("minor")}
              onCheckedChange={() => toggleSeverityFilter("minor")}
            >
              Minor
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        {/* Compliance Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full sm:w-auto">
              <Filter className="mr-2 h-4 w-4" />
              Compliance
              {complianceFilters.length > 0 && (
                <Badge className="ml-2 bg-green-500" variant="secondary">
                  {complianceFilters.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[200px]">
            <DropdownMenuLabel>Filter by Compliance</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={complianceFilters.includes("wcag2a")}
              onCheckedChange={() => toggleComplianceFilter("wcag2a")}
            >
              WCAG 2.0 A
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={complianceFilters.includes("wcag2aa")}
              onCheckedChange={() => toggleComplianceFilter("wcag2aa")}
            >
              WCAG 2.0 AA
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={complianceFilters.includes("wcag2aaa")}
              onCheckedChange={() => toggleComplianceFilter("wcag2aaa")}
            >
              WCAG 2.0 AAA
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={complianceFilters.includes("section508")}
              onCheckedChange={() => toggleComplianceFilter("section508")}
            >
              Section 508
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={complianceFilters.includes("best-practice")}
              onCheckedChange={() => toggleComplianceFilter("best-practice")}
            >
              Best Practices
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="severity">Sort by Severity</SelectItem>
            <SelectItem value="url">Sort by URL</SelectItem>
            <SelectItem value="date">Sort by Date</SelectItem>
          </SelectContent>
        </Select>
        
        <Button variant="outline" onClick={handleExport} disabled={exporting || results.length === 0}>
          {exporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Export
            </>
          )}
        </Button>
      </div>
      
      {/* Active filters display */}
      {(severityFilters.length > 0 || complianceFilters.length > 0) && (
        <div className="flex flex-wrap gap-2 mb-4">
          {severityFilters.map(severity => (
            <Badge key={severity} variant="outline" className="flex items-center gap-1">
              {severity}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => toggleSeverityFilter(severity)} 
              />
            </Badge>
          ))}
          {complianceFilters.map(compliance => (
            <Badge key={compliance} variant="outline" className="flex items-center gap-1">
              {compliance}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => toggleComplianceFilter(compliance)} 
              />
            </Badge>
          ))}
          {(severityFilters.length > 0 || complianceFilters.length > 0) && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear all filters
            </Button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          No results found. Add URLs to analyze or adjust your search filters.
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>URL</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead className="hidden md:table-cell">Element</TableHead>
                  <TableHead className="hidden lg:table-cell">Compliance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium truncate max-w-[150px]" title={result.url}>
                      <div className="flex items-center">
                        <span className="truncate">{result.url}</span>
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-1 text-gray-500 hover:text-gray-700"
                        >
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="truncate max-w-[200px]" title={result.message}>
                        {result.message}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 truncate" title={result.help}>
                        {result.help}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getSeverityColor(result.severity)}>{result.severity}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <code
                        className="text-xs bg-gray-100 text-black p-1 rounded truncate max-w-[200px] block"
                        title={result.element}
                      >
                        {result.element}
                      </code>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {result.tags?.map((tag, tagIndex) => (
                          <Badge key={tagIndex} className={getTagColor(tag)}>
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNumber = page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i

                if (pageNumber <= 0 || pageNumber > totalPages) return null

                return (
                  <PaginationItem key={i}>
                    <PaginationLink isActive={page === pageNumber} onClick={() => setPage(pageNumber)}>
                      {pageNumber}
                    </PaginationLink>
                  </PaginationItem>
                )
              })}
              <PaginationItem>
                <PaginationNext
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </>
      )}
    </div>
  )
}
