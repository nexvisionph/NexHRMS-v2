"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Form2316Data } from "@/store/bir-compliance.store";

interface Form2316Props {
  data: Form2316Data;
}

export function Form2316({ data }: Form2316Props) {
  const formatCurrency = (amount: number) => `₱${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="text-center border-b pb-4">
        <h2 className="text-lg font-bold">BIR Form 2316</h2>
        <p className="text-sm text-muted-foreground">Certificate of Compensation Payment/Tax Withheld</p>
        <p className="text-sm">For the Year {data.year}</p>
      </div>

      {/* Employer Information */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Part I — Employer Information</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <p><strong>Employer Name:</strong> {data.employer.name}</p>
          <p><strong>TIN:</strong> {data.employer.tin}</p>
          <p><strong>Address:</strong> {data.employer.address}</p>
          <p><strong>Zip Code:</strong> {data.employer.zipCode}</p>
        </CardContent>
      </Card>

      {/* Employee Information */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Part II — Employee Information</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <p><strong>Employee Name:</strong> {data.employeeName}</p>
          <p><strong>TIN:</strong> {data.tin || <Badge variant="outline" className="text-xs">Missing</Badge>}</p>
        </CardContent>
      </Card>

      {/* Compensation Details */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Part III — Compensation Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Basic Salary</TableCell>
                <TableCell className="text-right">{formatCurrency(data.compensation.basicSalary)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">13th Month Pay</TableCell>
                <TableCell className="text-right">{formatCurrency(data.compensation.thirteenthMonth)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Other Benefits</TableCell>
                <TableCell className="text-right">{formatCurrency(data.compensation.otherBenefits)}</TableCell>
              </TableRow>
              <TableRow className="border-t-2">
                <TableCell className="font-bold">Total Compensation</TableCell>
                <TableCell className="text-right font-bold">{formatCurrency(data.compensation.totalCompensation)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Less: Non-Taxable Income</TableCell>
                <TableCell className="text-right text-red-600">({formatCurrency(data.compensation.nonTaxableIncome)})</TableCell>
              </TableRow>
              <TableRow className="border-t-2">
                <TableCell className="font-bold">Taxable Income</TableCell>
                <TableCell className="text-right font-bold">{formatCurrency(data.compensation.taxableIncome)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Mandatory Deductions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Part IV — Mandatory Contributions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">SSS</TableCell>
                <TableCell className="text-right">{formatCurrency(data.deductions.sss)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">PhilHealth</TableCell>
                <TableCell className="text-right">{formatCurrency(data.deductions.philhealth)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Pag-IBIG</TableCell>
                <TableCell className="text-right">{formatCurrency(data.deductions.pagibig)}</TableCell>
              </TableRow>
              <TableRow className="border-t-2">
                <TableCell className="font-bold">Total Contributions</TableCell>
                <TableCell className="text-right font-bold">{formatCurrency(data.deductions.totalDeductions)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Tax Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Part V — Tax Computation</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Tax Due</TableCell>
                <TableCell className="text-right">{formatCurrency(data.tax.taxDue)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Tax Withheld</TableCell>
                <TableCell className="text-right">{formatCurrency(data.tax.taxWithheld)}</TableCell>
              </TableRow>
              <TableRow className="border-t-2">
                <TableCell className="font-bold">
                  {data.tax.overUnderWithholding >= 0 ? "Over-Withholding (Refund)" : "Under-Withholding (Collect)"}
                </TableCell>
                <TableCell className={`text-right font-bold ${data.tax.overUnderWithholding >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrency(Math.abs(data.tax.overUnderWithholding))}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Status */}
      <div className="flex justify-between items-center text-sm text-muted-foreground">
        <span>Generated: {new Date(data.generatedAt).toLocaleDateString()}</span>
        <Badge variant={data.status === "filed" ? "default" : "outline"}>{data.status}</Badge>
      </div>
    </div>
  );
}
