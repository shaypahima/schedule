import Link from "next/link";
import { requireActiveTraineeSession } from "@/lib/auth/session";
import { getTraineeProfile } from "@/lib/services/trainee-profile-repo";
import { saveProfile } from "./actions";

const ERRORS: Record<string, string> = {
  PHONE_INVALID: "מספר טלפון לא תקין. פורמט לדוגמה: ‎+972501234567",
  HEIGHT_OUT_OF_RANGE: "גובה צריך להיות בין 50 ל-250 ס\"מ.",
  WEIGHT_OUT_OF_RANGE: "משקל צריך להיות בין 20 ל-400 ק\"ג.",
};

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  dir,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  type?: string;
  dir?: "ltr" | "rtl";
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      <input
        name={name}
        type={type}
        dir={dir}
        placeholder={placeholder}
        defaultValue={defaultValue ?? ""}
        className="w-full rounded-lg border border-black/15 px-3 py-2"
      />
    </label>
  );
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; failed?: string }>;
}) {
  const session = await requireActiveTraineeSession();
  const [profile, { saved, failed }] = await Promise.all([
    getTraineeProfile(session.userId),
    searchParams,
  ]);

  return (
    <main className="flex-1 p-6">
      <div className="mx-auto w-full max-w-lg space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">הפרופיל שלי</h1>
          <Link href="/" className="text-sm underline">
            קביעת אימון
          </Link>
        </header>

        {saved && (
          <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
            הפרטים נשמרו.
          </p>
        )}
        {failed && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {ERRORS[failed] ?? "לא הצלחנו לשמור. נסו שוב."}
          </p>
        )}

        <form action={saveProfile} className="space-y-4">
          <Field
            label="טלפון"
            name="phone"
            type="tel"
            dir="ltr"
            placeholder="+972501234567"
            defaultValue={profile.phone}
          />
          <Field
            label="תאריך לידה"
            name="dateOfBirth"
            type="date"
            defaultValue={profile.dateOfBirth}
          />

          <div className="grid grid-cols-2 gap-4">
            <Field
              label='גובה (ס"מ)'
              name="heightCm"
              type="number"
              defaultValue={profile.heightCm}
            />
            <Field
              label='משקל (ק"ג)'
              name="weightKg"
              type="number"
              defaultValue={profile.weightKg}
            />
          </div>

          <label className="block space-y-1">
            <span className="text-sm font-medium">מטרות</span>
            <textarea
              name="goals"
              rows={3}
              defaultValue={profile.goals ?? ""}
              className="w-full rounded-lg border border-black/15 px-3 py-2"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium">מידע רפואי</span>
            <textarea
              name="medical"
              rows={3}
              defaultValue={profile.medical ?? ""}
              className="w-full rounded-lg border border-black/15 px-3 py-2"
            />
          </label>

          <p className="text-xs text-black/50">
            כל השדות רשות — אפשר להשלים בהדרגה. השארת שדה ריק מוחקת אותו.
          </p>

          <button
            type="submit"
            className="w-full rounded-lg bg-black px-4 py-3 font-medium text-white"
          >
            שמירה
          </button>
        </form>
      </div>
    </main>
  );
}
