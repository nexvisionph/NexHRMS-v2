"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { usePayrollRulesStore } from "@/store/payroll-rules.store";
import { Shield, AlertTriangle, DollarSign, Clock, Settings } from "lucide-react";
import type { PayrollRules, PayrollComplianceMode } from "@/types";

export function PayrollRulesTab() {
  const { rules, fetchRules, updateRules, isLoading } = usePayrollRulesStore();
  
  const [formData, setFormData] = useState<PayrollRules | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<PayrollComplianceMode | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Load rules on mount
  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  // Update form data when rules change
  useEffect(() => {
    if (rules) {
      setFormData(rules);
      setHasChanges(false);
    }
  }, [rules]);

  const handleFieldChange = (field: keyof PayrollRules, value: any) => {
    if (!formData) return;
    
    setFormData(prev => prev ? { ...prev, [field]: value } : null);
    setHasChanges(true);
  };

  const handleComplianceModeChange = (newMode: PayrollComplianceMode) => {
    if (newMode === 'custom' && rules?.complianceMode === 'ph_dole') {
      // Switching to custom requires confirmation
      setPendingMode(newMode);
      setConfirmModalOpen(true);
    } else {
      // Switching to PH DOLE or already custom - no confirmation needed
      handleFieldChange('complianceMode', newMode);
    }
  };

  const handleSave = async () => {
    if (!formData || !hasChanges) return;

    try {
      const result = await updateRules(formData);
      
      if (result.requiresConfirmation) {
        toast.warning("Please confirm the compliance mode change.");
        return;
      }

      if (!result.ok) {
        toast.error(result.message || "Failed to update payroll rules. Please try again.");
        return;
      }

      toast.success("Payroll rules updated successfully.");
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save payroll rules:', error);
      toast.error("Failed to update payroll rules. Please try again.");
    }
  };

  const confirmComplianceModeChange = async () => {
    if (!formData || !pendingMode) return;

    const updatedData = { ...formData, complianceMode: pendingMode };
    
    try {
      const result = await updateRules(updatedData, { confirmed: true });
      
      if (!result.ok) {
        toast.error(result.message || "Failed to change compliance mode. Please try again.");
        return;
      }
      
      toast.success(`Switched to ${pendingMode === 'custom' ? 'Custom Company Policy' : 'Philippine DOLE Standard'} mode.`);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to change compliance mode:', error);
      toast.error("Failed to change compliance mode. Please try again.");
    } finally {
      setConfirmModalOpen(false);
      setPendingMode(null);
    }
  };

  if (isLoading || !formData) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading payroll rules...</div>
        </CardContent>
      </Card>
    );
  }

  const isCustomMode = formData.complianceMode === 'custom';

  return (
    <div className="space-y-6">
      {/* Compliance Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Compliance Mode
          </CardTitle>
          <CardDescription>
            Choose between Philippine DOLE Standard rates or custom company policy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="compliance-mode">Mode</Label>
            <Select
              value={formData.complianceMode}
              onValueChange={(value) => handleComplianceModeChange(value as PayrollComplianceMode)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ph_dole">Philippine DOLE Standard</SelectItem>
                <SelectItem value="custom">Custom Company Policy</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isCustomMode && (
            <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-3">
              <strong>Custom Policy Mode:</strong> You are using company-specific multipliers. 
              Ensure all rates comply with local labor laws.
            </div>
          )}
        </CardContent>
      </Card>

      {/* OT Multipliers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Overtime Multipliers
          </CardTitle>
          <CardDescription>
            {isCustomMode 
              ? "Configure your company's overtime rates."
              : "Philippine DOLE standard rates (can be customized in Custom mode)."
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="regular-ot">Regular OT Multiplier</Label>
            <Input
              id="regular-ot"
              type="number"
              step="0.01"
              min="1.00"
              max="5.00"
              value={formData.regularOtMultiplier}
              onChange={(e) => handleFieldChange('regularOtMultiplier', parseFloat(e.target.value))}
              disabled={!isCustomMode}
            />
            <p className="text-xs text-muted-foreground">Default: 1.25x (DOLE standard)</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="restday-ot">Rest Day OT Multiplier</Label>
            <Input
              id="restday-ot"
              type="number"
              step="0.01"
              min="1.00"
              max="5.00"
              value={formData.restdayOtMultiplier}
              onChange={(e) => handleFieldChange('restdayOtMultiplier', parseFloat(e.target.value))}
              disabled={!isCustomMode}
            />
            <p className="text-xs text-muted-foreground">Default: 1.30x (DOLE standard)</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="special-holiday-ot">Special Holiday OT Multiplier</Label>
            <Input
              id="special-holiday-ot"
              type="number"
              step="0.01"
              min="1.00"
              max="5.00"
              value={formData.specialHolidayMultiplier}
              onChange={(e) => handleFieldChange('specialHolidayMultiplier', parseFloat(e.target.value))}
              disabled={!isCustomMode}
            />
            <p className="text-xs text-muted-foreground">Default: 1.30x (DOLE standard)</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="regular-holiday-ot">Regular Holiday OT Multiplier</Label>
            <Input
              id="regular-holiday-ot"
              type="number"
              step="0.01"
              min="1.00"
              max="5.00"
              value={formData.regularHolidayMultiplier}
              onChange={(e) => handleFieldChange('regularHolidayMultiplier', parseFloat(e.target.value))}
              disabled={!isCustomMode}
            />
            <p className="text-xs text-muted-foreground">Default: 2.60x (DOLE standard)</p>
          </div>
        </CardContent>
      </Card>

      {/* Holiday and Rest Day Rates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Holiday & Rest Day Rates
          </CardTitle>
          <CardDescription>
            Base multipliers for non-overtime work on special days.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="restday-holiday-multiplier">Rest Day + Holiday Multiplier</Label>
            <Input
              id="restday-holiday-multiplier"
              type="number"
              step="0.01"
              min="1.00"
              max="5.00"
              value={formData.restdayHolidayMultiplier}
              onChange={(e) => handleFieldChange('restdayHolidayMultiplier', parseFloat(e.target.value))}
              disabled={!isCustomMode}
            />
            <p className="text-xs text-muted-foreground">Default: 1.50x (DOLE standard)</p>
          </div>
        </CardContent>
      </Card>

      {/* Night Differential */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Night Differential
          </CardTitle>
          <CardDescription>
            Configure night shift premium rates and hours.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="enable-night-diff"
              checked={formData.enableNightDiff}
              onCheckedChange={(checked) => handleFieldChange('enableNightDiff', checked)}
              disabled={!isCustomMode}
            />
            <Label htmlFor="enable-night-diff">Enable Night Differential</Label>
          </div>

          {formData.enableNightDiff && (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="night-diff-multiplier">Night Differential Multiplier</Label>
                <Input
                  id="night-diff-multiplier"
                  type="number"
                  step="0.01"
                  min="1.00"
                  max="2.00"
                  value={formData.nightDiffMultiplier}
                  onChange={(e) => handleFieldChange('nightDiffMultiplier', parseFloat(e.target.value))}
                  disabled={!isCustomMode}
                />
                <p className="text-xs text-muted-foreground">Default: 1.10 (10% premium)</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="night-diff-start">Night Shift Start</Label>
                <Input
                  id="night-diff-start"
                  type="time"
                  value={formData.nightDiffStart}
                  onChange={(e) => handleFieldChange('nightDiffStart', e.target.value)}
                  disabled={!isCustomMode}
                />
                <p className="text-xs text-muted-foreground">Default: 22:00</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="night-diff-end">Night Shift End</Label>
                <Input
                  id="night-diff-end"
                  type="time"
                  value={formData.nightDiffEnd}
                  onChange={(e) => handleFieldChange('nightDiffEnd', e.target.value)}
                  disabled={!isCustomMode}
                />
                <p className="text-xs text-muted-foreground">Default: 06:00</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end space-x-2">
        <Button
          variant="outline"
          onClick={() => {
            if (rules) {
              setFormData(rules);
              setHasChanges(false);
            }
          }}
          disabled={!hasChanges}
        >
          Reset
        </Button>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || isLoading}
        >
          {isLoading ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Confirmation Modal */}
      <AlertDialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch to Custom Policy?</AlertDialogTitle>
            <AlertDialogDescription>
              You are switching from Philippine DOLE Standard to Custom Company Policy mode.
              <br /><br />
              In custom mode, you can modify overtime multipliers and other rates. 
              <strong>Ensure all custom rates comply with local labor laws.</strong>
              <br /><br />
              This change will affect all future payroll calculations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingMode(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmComplianceModeChange}>
              Switch to Custom Mode
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}