import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UrlForm } from "@/components/url-form"
import { ResultsTable } from "@/components/results-table"

export default function Home() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">WCAG Accessibility Checker</h1>
      <Tabs defaultValue="add-urls" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="add-urls">Add URLs</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>
        <TabsContent value="add-urls">
          <Card>
            <CardHeader>
              <CardTitle>Add URLs to Check</CardTitle>
              <CardDescription>Enter URLs to analyze for WCAG accessibility compliance</CardDescription>
            </CardHeader>
            <CardContent>
              <UrlForm />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="results">
          <Card>
            <CardHeader>
              <CardTitle>Accessibility Results</CardTitle>
              <CardDescription>View and filter accessibility issues found during analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <ResultsTable />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
