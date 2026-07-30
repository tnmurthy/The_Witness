import Link from "next/link";
import { Sparkles, Home, Settings, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Container, Grid } from "@/components/ui/container";
import { H1, H2, H3, H4, Lead, Text, Muted, Eyebrow, InlineCode } from "@/components/ui/typography";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

export const metadata = { title: "Design System" };

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 border-b border-neutral-200 py-10 first:pt-0 last:border-b-0">
      <Eyebrow>Design System</Eyebrow>
      <H2 className="mb-1 mt-1 text-2xl">{title}</H2>
      {description && <Text className="mb-6 max-w-2xl text-muted-foreground">{description}</Text>}
      <div className="space-y-6">{children}</div>
    </section>
  );
}

const SECTIONS = [
  ["typography", "Typography"],
  ["colors", "Color & Tokens"],
  ["grid", "Grid & Layout"],
  ["buttons", "Buttons"],
  ["badges", "Badges"],
  ["alerts", "Alerts"],
  ["cards", "Cards"],
  ["tables", "Tables"],
  ["forms", "Forms"],
  ["tabs-breadcrumb", "Tabs & Breadcrumb"],
  ["overlays", "Dialogs & Tooltips"],
  ["feedback", "Loading & Feedback"],
  ["navigation", "Navigation & Dashboard Shell"],
  ["accessibility", "Accessibility"],
] as const;

/**
 * Public, unauthenticated documentation route (deliberately outside the
 * (dashboard) route group and middleware's protected-route list — see
 * docs/DESIGN_SYSTEM.md, "Why this page is public"). Every example on
 * this page renders the actual component from src/components/ui, not a
 * static mockup — if this page builds and looks right, the components it
 * demonstrates are provably wired correctly, the same way
 * style-guide.html served that purpose for the token layer before any of
 * this was real application code.
 */
export default function DesignSystemPage() {
  return (
    <div className="min-h-screen bg-surface-page">
      <header className="border-b border-neutral-200 bg-card">
        <Container className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-2 font-voice text-lg font-semibold">
            <span className="h-4 w-1 bg-gold-700" aria-hidden="true" />
            The Witness — Design System
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/">Back to app</Link>
          </Button>
        </Container>
      </header>

      <Container className="flex gap-10 py-10">
        <nav
          aria-label="Section index"
          className="sticky top-20 hidden h-fit w-48 shrink-0 space-y-1 text-sm lg:block"
        >
          {SECTIONS.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="block rounded-md px-2 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              {label}
            </a>
          ))}
        </nav>

        <main className="min-w-0 flex-1">
          <div className="mb-10">
            <Eyebrow>v1.0 — Milestone 3</Eyebrow>
            <H1 className="mt-1">Design System</H1>
            <Lead className="mt-2 max-w-2xl">
              Every component below is the real, running component from{" "}
              <InlineCode>src/components/ui</InlineCode> — inspired by Apple&apos;s clarity, the Financial
              Times&apos; editorial authority, and Notion&apos;s product warmth. Full written documentation
              lives in <InlineCode>docs/DESIGN_SYSTEM.md</InlineCode>.
            </Lead>
          </div>

          <Section
            id="typography"
            title="Typography"
            description="Source Serif 4 for editorial headlines, IBM Plex Sans for UI, IBM Plex Mono for data."
          >
            <H1>Heading 1 — The signal, not the noise</H1>
            <H2>Heading 2 — editorial voice</H2>
            <H3>Heading 3 — UI sans</H3>
            <H4>Heading 4</H4>
            <Lead>Lead paragraph — used for page-level introductions, like the one above.</Lead>
            <Text>Body text — the default paragraph style for most in-app copy.</Text>
            <Muted>Muted text — secondary/supporting copy, timestamps, helper text.</Muted>
            <Eyebrow>Eyebrow label</Eyebrow>
            <p>
              Inline code: <InlineCode>const x = 1</InlineCode>
            </p>
          </Section>

          <Section
            id="colors"
            title="Color & Tokens"
            description="Full palette, contrast ratios, and token files are documented in docs/DESIGN_SYSTEM.md and the design-tokens.css source of truth."
          >
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {/* Full literal class names, deliberately not `bg-${c}` —
                  Tailwind's content scanner only picks up class names that
                  appear as complete strings in source, so a dynamically
                  constructed class name silently produces no CSS at all. */}
              <div className="space-y-1">
                <div className="h-14 rounded-md bg-navy-800" />
                <Muted className="font-mono text-xs">navy-800</Muted>
              </div>
              <div className="space-y-1">
                <div className="h-14 rounded-md bg-gold-700" />
                <Muted className="font-mono text-xs">gold-700</Muted>
              </div>
              <div className="space-y-1">
                <div className="h-14 rounded-md bg-success-600" />
                <Muted className="font-mono text-xs">success-600</Muted>
              </div>
              <div className="space-y-1">
                <div className="h-14 rounded-md bg-warning-600" />
                <Muted className="font-mono text-xs">warning-600</Muted>
              </div>
              <div className="space-y-1">
                <div className="h-14 rounded-md bg-danger-600" />
                <Muted className="font-mono text-xs">danger-600</Muted>
              </div>
            </div>
          </Section>

          <Section
            id="grid"
            title="Grid & Layout"
            description="Container and Grid helpers (src/components/ui/container.tsx) wrap the responsive breakpoints defined in design-tokens.css."
          >
            <Grid cols={{ base: 1, md: 2, xl: 4 }}>
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="rounded-md border border-dashed border-neutral-300 bg-surface-2 py-6 text-center text-sm text-muted-foreground"
                >
                  Column {n}
                </div>
              ))}
            </Grid>
          </Section>

          <Section
            id="buttons"
            title="Buttons"
            description="Six variants; signal (gold) is reserved for AI-initiated actions."
          >
            <div className="flex flex-wrap gap-3">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="signal">
                <Sparkles /> Signal
              </Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="link">Link</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
              <Button size="icon" aria-label="Settings">
                <Settings />
              </Button>
              <Button disabled>Disabled</Button>
            </div>
          </Section>

          <Section id="badges" title="Badges">
            <div className="flex flex-wrap gap-2">
              <Badge variant="neutral">Draft</Badge>
              <Badge variant="success">Published</Badge>
              <Badge variant="warning">Scheduled</Badge>
              <Badge variant="danger">Failed</Badge>
              <Badge variant="info">In review</Badge>
              <Badge variant="signal">AI-generated</Badge>
            </div>
          </Section>

          <Section
            id="alerts"
            title="Alerts"
            description="Persistent, in-flow status messaging. Use Sonner (toast) for transient feedback instead."
          >
            <Alert variant="info">
              <AlertTitle>Heads up</AlertTitle>
              <AlertDescription>This is an informational alert, role=&quot;status&quot;.</AlertDescription>
            </Alert>
            <Alert variant="success">
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>Your changes were saved.</AlertDescription>
            </Alert>
            <Alert variant="warning">
              <AlertTitle>Review needed</AlertTitle>
              <AlertDescription>This wisdom entry hasn&apos;t been approved yet.</AlertDescription>
            </Alert>
            <Alert variant="danger">
              <AlertTitle>Something went wrong</AlertTitle>
              <AlertDescription>
                role=&quot;alert&quot; — announced immediately by screen readers.
              </AlertDescription>
            </Alert>
          </Section>

          <Section id="cards" title="Cards">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Standard card</CardTitle>
                  <CardDescription>The base Card primitive.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Text>Card content area.</Text>
                </CardContent>
                <CardFooter>
                  <Button size="sm">Action</Button>
                </CardFooter>
              </Card>
              <div className="rounded-sm border-l-4 border-gold-700 bg-card p-5">
                <Eyebrow>Signal</Eyebrow>
                <H4 className="mt-1">Signal Card treatment</H4>
                <Muted>Print margin-note style — used for AI-generated editorial blocks.</Muted>
              </div>
            </div>
          </Section>

          <Section
            id="tables"
            title="Tables"
            description="Hairline dividers, muted uppercase headers. Used for the Admin Users and Organization Members lists."
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Ada Admin</TableCell>
                  <TableCell>Super Admin</TableCell>
                  <TableCell>
                    <Badge variant="success">Active</Badge>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Wes Writer</TableCell>
                  <TableCell>Writer</TableCell>
                  <TableCell>
                    <Badge variant="success">Active</Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Section>

          <Section
            id="forms"
            title="Forms"
            description="40px controls, gold focus ring, gold required-marker (never red — red is reserved for errors)."
          >
            <div className="grid max-w-xl gap-5">
              <div className="space-y-1.5">
                <Label htmlFor="demo-input">
                  Issue title <span className="text-gold-700">*</span>
                </Label>
                <Input id="demo-input" placeholder="The RAG reckoning" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="demo-textarea">Summary</Label>
                <Textarea id="demo-textarea" placeholder="One or two sentences…" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="demo-select">Publication</Label>
                <Select defaultValue="witness">
                  <SelectTrigger id="demo-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="witness">The Witness</SelectItem>
                    <SelectItem value="career">Career Compass</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="demo-check" defaultChecked />
                <Label htmlFor="demo-check">Notify members on publish</Label>
              </div>
              <RadioGroup defaultValue="now" className="gap-2">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="now" id="r-now" />
                  <Label htmlFor="r-now">Publish immediately</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="later" id="r-later" />
                  <Label htmlFor="r-later">Schedule for later</Label>
                </div>
              </RadioGroup>
              <div className="flex items-center gap-2">
                <Switch id="demo-switch" defaultChecked />
                <Label htmlFor="demo-switch">AI-assisted drafting</Label>
              </div>
            </div>
          </Section>

          <Section id="tabs-breadcrumb" title="Tabs & Breadcrumb">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/organizations">Organizations</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Example Org</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <Tabs defaultValue="general">
              <TabsList>
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="members">Members</TabsTrigger>
                <TabsTrigger value="billing">Billing</TabsTrigger>
              </TabsList>
              <TabsContent value="general">
                <Text>General settings panel.</Text>
              </TabsContent>
              <TabsContent value="members">
                <Text>Members panel.</Text>
              </TabsContent>
              <TabsContent value="billing">
                <Text>Billing panel.</Text>
              </TabsContent>
            </Tabs>
          </Section>

          <Section id="overlays" title="Dialogs & Tooltips">
            <div className="flex flex-wrap items-center gap-3">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="signal">
                    <Sparkles /> Generate issue
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Generate issue</DialogTitle>
                    <DialogDescription>
                      The AI Workspace drafts editable blocks from recent coverage.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="ghost">Cancel</Button>
                    </DialogClose>
                    <Button variant="signal">Generate</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Info">
                    <Info />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Hover/focus tooltip</TooltipContent>
              </Tooltip>
            </div>
          </Section>

          <Section id="feedback" title="Loading & Feedback">
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback>TW</AvatarFallback>
              </Avatar>
              <Separator orientation="vertical" className="h-8" />
              <Muted>Avatar + Separator</Muted>
            </div>
          </Section>

          <Section
            id="navigation"
            title="Navigation & Dashboard Shell"
            description="Sidebar, Topbar, MobileNav, and AppShell compose the app chrome you're using right now if you're signed in — see them live at /dashboard."
          >
            <div className="flex gap-3">
              <Button asChild variant="outline">
                <Link href="/dashboard">
                  <Home /> View live dashboard shell
                </Link>
              </Button>
            </div>
            <Muted>
              The sidebar (desktop, ≥768px) and the hamburger-triggered Sheet drawer (mobile, &lt;768px) share
              one NAV_ITEMS source of truth — src/components/layout/nav-items.ts.
            </Muted>
          </Section>

          <Section
            id="accessibility"
            title="Accessibility"
            description="Full contrast verification and guidelines: docs/DESIGN_SYSTEM.md, 'Accessibility.'"
          >
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground">
              <li>
                Every interactive element has a visible focus ring (2px offset + gold-700, 5.27:1 contrast).
              </li>
              <li>
                Alert uses role=&quot;alert&quot;/role=&quot;status&quot; based on urgency, not decoration.
              </li>
              <li>Required-field markers are gold, never red — red is reserved for errors only.</li>
              <li>Skeleton respects prefers-reduced-motion globally, no per-component opt-out needed.</li>
              <li>
                This page itself: one H1, semantic landmark regions, skip-link inherited from the root layout.
              </li>
            </ul>
          </Section>
        </main>
      </Container>
    </div>
  );
}
