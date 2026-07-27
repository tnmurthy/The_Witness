"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { publishingScheduleSchema, type PublishingSchedule } from "@/lib/validation/publications";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

export function ScheduleForm({ publicationId, initial }: { publicationId: string; initial: Partial<PublishingSchedule> }) {
  const router = useRouter();
  const form = useForm<PublishingSchedule>({
    resolver: zodResolver(publishingScheduleSchema),
    defaultValues: {
      frequency: initial.frequency ?? "weekly",
      daysOfWeek: initial.daysOfWeek ?? [],
      timeOfDay: initial.timeOfDay ?? "07:00",
      timezone: initial.timezone ?? "UTC",
    },
  });

  async function onSubmit(values: PublishingSchedule) {
    try {
      const res = await fetch(`/api/publications/${publicationId}/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save");

      toast.success("Publishing schedule saved");
      router.refresh();
    } catch (error) {
      logger.error("Schedule update failed in UI", { error, publicationId });
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    }
  }

  const daysOfWeek = form.watch("daysOfWeek");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="max-w-lg space-y-6">
        <FormField
          control={form.control}
          name="frequency"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Frequency</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Biweekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div>
          <Label>Days of week</Label>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {DAYS.map((day) => (
              <div key={day} className="flex items-center gap-2">
                <Checkbox
                  id={`day-${day}`}
                  checked={daysOfWeek?.includes(day)}
                  onCheckedChange={(checked) => {
                    const current = form.getValues("daysOfWeek") ?? [];
                    form.setValue("daysOfWeek", checked ? [...current, day] : current.filter((d) => d !== day));
                  }}
                />
                <Label htmlFor={`day-${day}`} className="text-sm font-normal capitalize">
                  {day.slice(0, 3)}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <FormField
          control={form.control}
          name="timeOfDay"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Time of day</FormLabel>
              <FormControl>
                <Input type="time" className="w-40" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="timezone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Timezone</FormLabel>
              <FormControl>
                <Input placeholder="America/New_York" {...field} />
              </FormControl>
              <FormDescription>IANA timezone name. Read by the Milestone 10 scheduler, not enforced here.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving…" : "Save schedule"}
        </Button>
      </form>
    </Form>
  );
}
