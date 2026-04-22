"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Loader2, Plus } from "lucide-react";
import { addProblem } from "@/lib/actions/problems";
import { DIFFICULTY_CONFIG } from "@/lib/constants";
import type { Difficulty } from "@/lib/schemas";
import { toast } from "sonner";

export function AddProblemDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("MEDIUM");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      await addProblem({ title: title.trim(), difficulty });
      setTitle("");
      setDifficulty("MEDIUM");
      setOpen(false);
      onAdded();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add problem");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button aria-label="Add problem" variant="ghost" size="icon" className="h-8 w-8 text-lg text-primary bg-primary/10 hover:bg-primary/20" />}>+</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Problem</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="problem-title">Title</Label>
              <Input
                id="problem-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Two Sum"
                autoComplete="off"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="difficulty">Difficulty</Label>
              <Select
                value={difficulty}
                onValueChange={(v) => setDifficulty(v as Difficulty)}
              >
                <SelectTrigger id="difficulty">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${DIFFICULTY_CONFIG[difficulty].bgColor} ${DIFFICULTY_CONFIG[difficulty].color}`}>
                    {DIFFICULTY_CONFIG[difficulty].label}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {(["EASY", "MEDIUM", "HARD"] as Difficulty[]).map((d) => {
                    const cfg = DIFFICULTY_CONFIG[d];
                    return (
                      <SelectItem key={d} value={d}>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.bgColor} ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <span className="flex items-center justify-between gap-2">
                  Add <Plus className="h-3.5 w-3.5" />
                </span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
