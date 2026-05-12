"use client";

import { useState, useMemo } from "react";
import { useJobsStore, type JobStatus, type JobType, type ExperienceLevel } from "@/store/jobs.store";
import { useAuthStore } from "@/store/auth.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Briefcase, Search, Plus, Users, Clock, CheckCircle } from "lucide-react";

const STATUS_COLORS: Record<JobStatus, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  open: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  closed: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  on_hold: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  filled: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
};

export default function JobsPage() {
  const { jobs, createJob, publishJob, closeJob, holdJob, deleteJob, getApplicationCount } = useJobsStore();
  const currentUser = useAuthStore((s) => s.currentUser);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const [newJob, setNewJob] = useState({
    title: "",
    department: "",
    location: "",
    jobType: "full_time" as JobType,
    experienceLevel: "mid" as ExperienceLevel,
    description: "",
    requirements: "",
    responsibilities: "",
    openings: 1,
    salaryMin: 0,
    salaryMax: 0,
    closingDate: "",
  });

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      if (filterStatus !== "all" && j.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        return j.title.toLowerCase().includes(q) || j.department.toLowerCase().includes(q);
      }
      return true;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [jobs, filterStatus, search]);

  const handleCreate = () => {
    if (!newJob.title || !newJob.department) return;
    createJob({
      ...newJob,
      requirements: newJob.requirements.split("\n").filter(Boolean),
      responsibilities: newJob.responsibilities.split("\n").filter(Boolean),
      salaryMin: newJob.salaryMin || undefined,
      salaryMax: newJob.salaryMax || undefined,
      closingDate: newJob.closingDate || undefined,
      postedBy: currentUser.name || "Admin",
    });
    setShowCreateDialog(false);
    setNewJob({ title: "", department: "", location: "", jobType: "full_time", experienceLevel: "mid", description: "", requirements: "", responsibilities: "", openings: 1, salaryMin: 0, salaryMax: 0, closingDate: "" });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Jobs & Recruitment</h1>
          <p className="text-muted-foreground">Manage job postings and track applications.</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />New Job Posting</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Job Posting</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Job Title</Label>
                <Input value={newJob.title} onChange={(e) => setNewJob({ ...newJob, title: e.target.value })} placeholder="e.g., Senior Frontend Developer" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Department</Label>
                  <Input value={newJob.department} onChange={(e) => setNewJob({ ...newJob, department: e.target.value })} placeholder="Engineering" />
                </div>
                <div>
                  <Label>Location</Label>
                  <Input value={newJob.location} onChange={(e) => setNewJob({ ...newJob, location: e.target.value })} placeholder="Manila" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Job Type</Label>
                  <Select value={newJob.jobType} onValueChange={(v) => setNewJob({ ...newJob, jobType: v as JobType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_time">Full Time</SelectItem>
                      <SelectItem value="part_time">Part Time</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="internship">Internship</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Experience Level</Label>
                  <Select value={newJob.experienceLevel} onValueChange={(v) => setNewJob({ ...newJob, experienceLevel: v as ExperienceLevel })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entry">Entry Level</SelectItem>
                      <SelectItem value="mid">Mid Level</SelectItem>
                      <SelectItem value="senior">Senior</SelectItem>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="executive">Executive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Openings</Label>
                <Input type="number" min={1} value={newJob.openings} onChange={(e) => setNewJob({ ...newJob, openings: parseInt(e.target.value) || 1 })} />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={newJob.description} onChange={(e) => setNewJob({ ...newJob, description: e.target.value })} rows={3} />
              </div>
              <div>
                <Label>Requirements (one per line)</Label>
                <Textarea value={newJob.requirements} onChange={(e) => setNewJob({ ...newJob, requirements: e.target.value })} rows={3} placeholder="3+ years React experience&#10;TypeScript proficiency" />
              </div>
              <div>
                <Label>Responsibilities (one per line)</Label>
                <Textarea value={newJob.responsibilities} onChange={(e) => setNewJob({ ...newJob, responsibilities: e.target.value })} rows={3} />
              </div>
              <div>
                <Label>Closing Date (optional)</Label>
                <Input type="date" value={newJob.closingDate} onChange={(e) => setNewJob({ ...newJob, closingDate: e.target.value })} />
              </div>
              <Button onClick={handleCreate} className="w-full">Create Job Posting</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Briefcase className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{jobs.length}</p>
                <p className="text-sm text-muted-foreground">Total Postings</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{jobs.filter((j) => j.status === "open").length}</p>
                <p className="text-sm text-muted-foreground">Open Positions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{jobs.reduce((s, j) => s + j.openings, 0)}</p>
                <p className="text-sm text-muted-foreground">Total Openings</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{jobs.filter((j) => j.status === "draft").length}</p>
                <p className="text-sm text-muted-foreground">Drafts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search jobs..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="filled">Filled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Jobs Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Openings</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Applications</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No job postings found. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">{job.title}</TableCell>
                    <TableCell>{job.department}</TableCell>
                    <TableCell className="capitalize">{job.jobType.replace(/_/g, " ")}</TableCell>
                    <TableCell>{job.filledCount}/{job.openings}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[job.status]}>{job.status}</Badge>
                    </TableCell>
                    <TableCell>{getApplicationCount(job.id)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {job.status === "draft" && (
                          <Button size="sm" variant="outline" onClick={() => publishJob(job.id)}>Publish</Button>
                        )}
                        {job.status === "open" && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => holdJob(job.id)}>Hold</Button>
                            <Button size="sm" variant="outline" onClick={() => closeJob(job.id)}>Close</Button>
                          </>
                        )}
                        {job.status === "on_hold" && (
                          <Button size="sm" variant="outline" onClick={() => publishJob(job.id)}>Reopen</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
