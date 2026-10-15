import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { updateUserProfile, type UserProfile } from "../lib/api";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";

export function UserProfileDialog({
  user,
  open,
  onOpenChange,
}: {
  user: UserProfile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState(user.fullName);
  const [email, setEmail] = useState(user.email);
  const profileMutation = useMutation({
    mutationFn: updateUserProfile,
    onSuccess: async profile => {
      queryClient.setQueryData(["current-user"], profile);
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      onOpenChange(false);
    },
  });

  useEffect(() => {
    if (open) {
      setFullName(user.fullName);
      setEmail(user.email);
      profileMutation.reset();
    }
  }, [open, user.fullName, user.email]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle className="text-base font-semibold text-slate-800">Your profile</DialogTitle>
        <DialogDescription className="mb-4 mt-1.5 text-xs text-muted">
          Update the name and email address associated with your account.
        </DialogDescription>
        <form
          className="space-y-4"
          onSubmit={event => {
            event.preventDefault();
            profileMutation.mutate({ fullName, email });
          }}
        >
          <label className="block space-y-1.5 text-xs font-medium text-slate-700">
            Full name
            <Input
              required
              maxLength={120}
              autoComplete="name"
              value={fullName}
              onChange={event => setFullName(event.target.value)}
            />
          </label>
          <label className="block space-y-1.5 text-xs font-medium text-slate-700">
            Email
            <Input
              required
              type="email"
              maxLength={254}
              autoComplete="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
            />
          </label>
          {profileMutation.isError && (
            <p className="text-xs text-red-600" role="alert">{profileMutation.error.message}</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={profileMutation.isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={profileMutation.isPending || !fullName.trim()}>
              {profileMutation.isPending && <LoaderCircle size={14} className="animate-spin" />}
              Save profile
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
