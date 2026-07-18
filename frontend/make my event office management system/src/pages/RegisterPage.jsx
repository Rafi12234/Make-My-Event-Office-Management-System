import { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  IdCard,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
} from "lucide-react";

const initialFormData = {
  fullName: "",
  employeeCode: "",
  email: "",
  phone: "",
  departmentId: "",
  designation: "",
  password: "",
  confirmPassword: "",
  acceptedTerms: false,
};

const departments = [
  {
    id: "1",
    name: "Management",
  },
  {
    id: "2",
    name: "Client Relations",
  },
  {
    id: "3",
    name: "Event Operations",
  },
  {
    id: "4",
    name: "Finance",
  },
];

function calculatePasswordStrength(password) {
  let score = 0;

  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  return score;
}

function FormField({
  label,
  name,
  type = "text",
  value,
  placeholder,
  icon: Icon,
  error,
  required = false,
  onChange,
  autoComplete,
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-2 block text-sm font-extrabold text-mme-purple"
      >
        {label}

        {required && <span className="ml-1 text-red-500">*</span>}
      </label>

      <div className="relative">
        <Icon
          size={18}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-mme-plum"
        />

        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          className={`w-full rounded-2xl border bg-white py-3.5 pl-12 pr-4 text-sm font-medium text-mme-purple outline-none transition placeholder:text-mme-purple/35 ${
            error
              ? "border-red-400 ring-4 ring-red-100"
              : "border-mme-pink/80 focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/25"
          }`}
        />
      </div>

      {error && (
        <p className="mt-1.5 text-xs font-semibold text-red-500">{error}</p>
      )}
    </div>
  );
}

function PasswordField({
  label,
  name,
  value,
  placeholder,
  error,
  required = false,
  onChange,
  showPassword,
  onTogglePassword,
  autoComplete,
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-2 block text-sm font-extrabold text-mme-purple"
      >
        {label}

        {required && <span className="ml-1 text-red-500">*</span>}
      </label>

      <div className="relative">
        <LockKeyhole
          size={18}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-mme-plum"
        />

        <input
          id={name}
          name={name}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          className={`w-full rounded-2xl border bg-white py-3.5 pl-12 pr-12 text-sm font-medium text-mme-purple outline-none transition placeholder:text-mme-purple/35 ${
            error
              ? "border-red-400 ring-4 ring-red-100"
              : "border-mme-pink/80 focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/25"
          }`}
        />

        <button
          type="button"
          onClick={onTogglePassword}
          className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg p-1 text-mme-purple/50 transition hover:bg-mme-blush/50 hover:text-mme-purple"
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      {error && (
        <p className="mt-1.5 text-xs font-semibold text-red-500">{error}</p>
      )}
    </div>
  );
}

function RegistrationSuccess({ email, onRegisterAnother }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FFF9FC] px-5 py-12">
      <div className="relative w-full max-w-xl overflow-hidden rounded-[32px] border border-mme-pink/60 bg-white p-7 text-center shadow-[0_30px_90px_rgba(91,55,101,0.16)] sm:p-12">
        <div className="absolute -left-16 -top-16 h-48 w-48 rounded-full bg-mme-blush/65 blur-3xl" />
        <div className="absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-mme-mauve/30 blur-3xl" />

        <div className="relative">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-mme-blush text-mme-purple">
            <Clock3 size={38} />
          </div>

          <p className="mt-7 text-sm font-black uppercase tracking-[0.2em] text-mme-plum">
            Registration submitted
          </p>

          <h1 className="mt-3 text-3xl font-black text-mme-purple sm:text-4xl">
            Waiting for admin approval
          </h1>

          <p className="mx-auto mt-5 max-w-md leading-7 text-mme-purple/65">
            Your employee registration has been submitted successfully. An
            administrator must review and approve your account before you can
            log in.
          </p>

          <div className="mt-7 rounded-2xl border border-mme-pink/70 bg-mme-blush/25 p-5">
            <p className="text-xs font-extrabold uppercase tracking-wider text-mme-plum">
              Registered email
            </p>

            <p className="mt-2 break-all font-black text-mme-purple">{email}</p>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/"
              className="flex-1 rounded-2xl bg-mme-purple px-6 py-3.5 text-center text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-[#4b2c55]"
            >
              Return to home
            </Link>

            <button
              type="button"
              onClick={onRegisterAnother}
              className="flex-1 rounded-2xl border border-mme-purple/20 bg-white px-6 py-3.5 text-sm font-black text-mme-purple transition hover:-translate-y-0.5 hover:bg-mme-blush/30"
            >
              Register another
            </button>
          </div>

          <p className="mt-6 text-xs leading-5 text-mme-purple/50">
            You will be able to log in only after your registration status
            becomes approved.
          </p>
        </div>
      </div>
    </div>
  );
}

function RegisterPage() {
  const [formData, setFormData] = useState(initialFormData);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationCompleted, setRegistrationCompleted] = useState(false);

  const passwordStrength = useMemo(
    () => calculatePasswordStrength(formData.password),
    [formData.password],
  );

  const passwordStrengthText = useMemo(() => {
    if (!formData.password) return "";
    if (passwordStrength <= 2) return "Weak";
    if (passwordStrength <= 4) return "Good";
    return "Strong";
  }, [formData.password, passwordStrength]);

  function handleInputChange(event) {
    const { name, value, type, checked } = event.target;

    setFormData((currentData) => ({
      ...currentData,
      [name]: type === "checkbox" ? checked : value,
    }));

    if (errors[name]) {
      setErrors((currentErrors) => ({
        ...currentErrors,
        [name]: "",
      }));
    }
  }

  function validateForm() {
    const newErrors = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = "Full name is required.";
    }

    if (!formData.employeeCode.trim()) {
      newErrors.employeeCode = "Employee ID is required.";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Work email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Enter a valid email address.";
    }

    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required.";
    } else if (!/^[0-9+\-\s()]{8,20}$/.test(formData.phone)) {
      newErrors.phone = "Enter a valid phone number.";
    }

    if (!formData.departmentId) {
      newErrors.departmentId = "Select your department.";
    }

    if (!formData.designation.trim()) {
      newErrors.designation = "Designation is required.";
    }

    if (!formData.password) {
      newErrors.password = "Password is required.";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must contain at least 8 characters.";
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password.";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match.";
    }

    if (!formData.acceptedTerms) {
      newErrors.acceptedTerms =
        "You must confirm that the information is correct.";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    const registrationPayload = {
      full_name: formData.fullName.trim(),
      employee_code: formData.employeeCode.trim(),
      email: formData.email.trim().toLowerCase(),
      phone: formData.phone.trim(),
      department_id: Number(formData.departmentId),
      designation: formData.designation.trim(),
      password: formData.password,
      password_confirmation: formData.confirmPassword,
    };

    try {
      /*
       * FRONTEND DEMO BEHAVIOUR
       *
       * The backend registration API is not connected yet.
       * This delay temporarily simulates a successful API request.
       *
       * Later replace this section with:
       *
       * const response = await fetch(
       *   `${import.meta.env.VITE_API_BASE_URL}/auth/register`,
       *   {
       *     method: "POST",
       *     headers: {
       *       "Content-Type": "application/json",
       *       Accept: "application/json",
       *     },
       *     body: JSON.stringify(registrationPayload),
       *   },
       * );
       *
       * const result = await response.json();
       *
       * if (!response.ok) {
       *   throw new Error(result.message || "Registration failed.");
       * }
       */

      await new Promise((resolve) => setTimeout(resolve, 900));

      console.log("Registration payload:", registrationPayload);

      setRegistrationCompleted(true);
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (error) {
      setErrors({
        submit:
          error instanceof Error
            ? error.message
            : "Registration could not be completed.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetRegistration() {
    setFormData(initialFormData);
    setErrors({});
    setRegistrationCompleted(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
  }

  if (registrationCompleted) {
    return (
      <RegistrationSuccess
        email={formData.email}
        onRegisterAnother={resetRegistration}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF9FC] text-mme-purple">
      <div className="grid min-h-screen lg:grid-cols-[0.8fr_1.2fr]">
        {/* Left information area */}
        <aside className="relative hidden overflow-hidden bg-mme-purple p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
          <div className="absolute -left-24 top-20 h-80 w-80 rounded-full bg-mme-mauve/25 blur-3xl" />
          <div className="absolute -bottom-20 -right-16 h-96 w-96 rounded-full bg-mme-pink/15 blur-3xl" />

          <div className="relative">
            <Link to="/" className="inline-flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xl font-black text-mme-purple shadow-xl">
                M
              </div>

              <div>
                <p className="text-xl font-black leading-none">Make My Event</p>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-mme-pink">
                  Office Management
                </p>
              </div>
            </Link>

            <div className="mt-20 max-w-lg">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-mme-pink backdrop-blur-md">
                <Sparkles size={15} />
                Employee registration
              </div>

              <h1 className="mt-7 text-4xl font-black leading-[1.1] xl:text-5xl">
                Join your office workspace securely.
              </h1>

              <p className="mt-6 max-w-md text-base leading-8 text-white/70">
                Register using your employee information. Your account will
                remain pending until an administrator reviews and approves it.
              </p>
            </div>

            <div className="mt-14 space-y-5">
              {[
                {
                  icon: ShieldCheck,
                  title: "Admin-approved access",
                  description:
                    "Unauthorized registrations cannot enter the office system.",
                },
                {
                  icon: UsersRound,
                  title: "Shared office workspace",
                  description:
                    "Access client records, meetings and shared office tasks.",
                },
                {
                  icon: Clock3,
                  title: "Calendar and reminders",
                  description:
                    "See upcoming meetings, follow-ups and deadlines.",
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.title} className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-mme-pink">
                      <Icon size={21} />
                    </div>

                    <div>
                      <h2 className="font-black">{item.title}</h2>

                      <p className="mt-1 max-w-sm text-sm leading-6 text-white/60">
                        {item.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative mt-12 rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={20} className="text-mme-pink" />

              <p className="text-sm font-bold">
                Your office information remains protected.
              </p>
            </div>
          </div>
        </aside>

        {/* Registration form */}
        <main className="relative flex min-h-screen items-center px-5 py-8 sm:px-8 lg:px-12 xl:px-20">
          <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-mme-blush/50 blur-3xl" />

          <div className="relative mx-auto w-full max-w-3xl">
            <div className="mb-8 flex items-center justify-between">
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-black text-mme-purple/65 transition hover:bg-mme-blush/40 hover:text-mme-purple"
              >
                <ArrowLeft size={18} />
                Back to home
              </Link>

              <div className="flex items-center gap-2 lg:hidden">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mme-purple font-black text-white">
                  M
                </div>

                <p className="hidden font-black text-mme-purple sm:block">
                  Make My Event
                </p>
              </div>
            </div>

            <div className="rounded-[30px] border border-mme-pink/60 bg-white p-5 shadow-[0_30px_80px_rgba(91,55,101,0.12)] sm:p-8 xl:p-10">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-mme-plum">
                  Create employee account
                </p>

                <h1 className="mt-3 text-3xl font-black tracking-tight text-mme-purple sm:text-4xl">
                  Employee registration
                </h1>

                <p className="mt-3 leading-7 text-mme-purple/60">
                  Enter your official employee information. Fields marked with
                  an asterisk are required.
                </p>
              </div>

              <div className="mt-7 flex items-start gap-3 rounded-2xl border border-mme-pink/70 bg-mme-blush/25 p-4">
                <ShieldCheck
                  size={21}
                  className="mt-0.5 shrink-0 text-mme-plum"
                />

                <div>
                  <p className="text-sm font-black text-mme-purple">
                    Administrator approval required
                  </p>

                  <p className="mt-1 text-xs leading-5 text-mme-purple/60">
                    Registration does not provide immediate access. You can log
                    in only after an administrator approves your account.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="mt-8">
                <div className="grid gap-5 sm:grid-cols-2">
                  <FormField
                    label="Full name"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    placeholder="Enter your full name"
                    icon={UserRound}
                    error={errors.fullName}
                    required
                    autoComplete="name"
                  />

                  <FormField
                    label="Employee ID"
                    name="employeeCode"
                    value={formData.employeeCode}
                    onChange={handleInputChange}
                    placeholder="Example: MME-1024"
                    icon={IdCard}
                    error={errors.employeeCode}
                    required
                    autoComplete="off"
                  />

                  <FormField
                    label="Work email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="name@makemyevent.com"
                    icon={Mail}
                    error={errors.email}
                    required
                    autoComplete="email"
                  />

                  <FormField
                    label="Phone number"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="01XXXXXXXXX"
                    icon={Phone}
                    error={errors.phone}
                    required
                    autoComplete="tel"
                  />

                  <div>
                    <label
                      htmlFor="departmentId"
                      className="mb-2 block text-sm font-extrabold text-mme-purple"
                    >
                      Department
                      <span className="ml-1 text-red-500">*</span>
                    </label>

                    <div className="relative">
                      <Building2
                        size={18}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-mme-plum"
                      />

                      <select
                        id="departmentId"
                        name="departmentId"
                        value={formData.departmentId}
                        onChange={handleInputChange}
                        className={`w-full appearance-none rounded-2xl border bg-white py-3.5 pl-12 pr-10 text-sm font-medium text-mme-purple outline-none transition ${
                          errors.departmentId
                            ? "border-red-400 ring-4 ring-red-100"
                            : "border-mme-pink/80 focus:border-mme-plum focus:ring-4 focus:ring-mme-pink/25"
                        }`}
                      >
                        <option value="">Select department</option>

                        {departments.map((department) => (
                          <option key={department.id} value={department.id}>
                            {department.name}
                          </option>
                        ))}
                      </select>

                      <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-mme-plum">
                        ▾
                      </div>
                    </div>

                    {errors.departmentId && (
                      <p className="mt-1.5 text-xs font-semibold text-red-500">
                        {errors.departmentId}
                      </p>
                    )}
                  </div>

                  <FormField
                    label="Designation"
                    name="designation"
                    value={formData.designation}
                    onChange={handleInputChange}
                    placeholder="Example: Event Coordinator"
                    icon={UsersRound}
                    error={errors.designation}
                    required
                    autoComplete="organization-title"
                  />

                  <PasswordField
                    label="Password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Minimum 8 characters"
                    error={errors.password}
                    required
                    showPassword={showPassword}
                    onTogglePassword={() =>
                      setShowPassword((current) => !current)
                    }
                    autoComplete="new-password"
                  />

                  <PasswordField
                    label="Confirm password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="Enter password again"
                    error={errors.confirmPassword}
                    required
                    showPassword={showConfirmPassword}
                    onTogglePassword={() =>
                      setShowConfirmPassword((current) => !current)
                    }
                    autoComplete="new-password"
                  />
                </div>

                {formData.password && (
                  <div className="mt-4 rounded-2xl bg-[#FFF9FC] p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-extrabold text-mme-purple/65">
                        Password strength
                      </p>

                      <p className="text-xs font-black text-mme-plum">
                        {passwordStrengthText}
                      </p>
                    </div>

                    <div className="mt-3 grid grid-cols-5 gap-2">
                      {[1, 2, 3, 4, 5].map((item) => (
                        <div
                          key={item}
                          className={`h-1.5 rounded-full transition ${
                            item <= passwordStrength
                              ? "bg-mme-plum"
                              : "bg-mme-pink/45"
                          }`}
                        />
                      ))}
                    </div>

                    <p className="mt-3 text-[11px] leading-5 text-mme-purple/50">
                      Use uppercase and lowercase letters, numbers and a special
                      character for a stronger password.
                    </p>
                  </div>
                )}

                <div className="mt-6">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      name="acceptedTerms"
                      checked={formData.acceptedTerms}
                      onChange={handleInputChange}
                      className="peer sr-only"
                    />

                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-mme-mauve bg-white text-white transition peer-checked:border-mme-purple peer-checked:bg-mme-purple">
                      {formData.acceptedTerms && <Check size={14} />}
                    </span>

                    <span className="text-sm leading-6 text-mme-purple/65">
                      I confirm that the information provided is correct and
                      belongs to me as an employee of Make My Event.
                    </span>
                  </label>

                  {errors.acceptedTerms && (
                    <p className="ml-8 mt-1 text-xs font-semibold text-red-500">
                      {errors.acceptedTerms}
                    </p>
                  )}
                </div>

                {errors.submit && (
                  <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-600">
                    {errors.submit}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl bg-mme-purple px-6 py-4 text-sm font-black text-white shadow-xl shadow-mme-purple/20 transition hover:-translate-y-0.5 hover:bg-[#4b2c55] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  {isSubmitting ? (
                    <>
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Submitting registration...
                    </>
                  ) : (
                    <>
                      Submit for approval
                      <ShieldCheck size={19} />
                    </>
                  )}
                </button>

                <p className="mt-6 text-center text-sm text-mme-purple/60">
                  Already registered?{" "}
                  <Link
                    to="/login"
                    className="font-black text-mme-plum transition hover:text-mme-purple"
                  >
                    Log in here
                  </Link>
                </p>
              </form>
            </div>

            <p className="mt-6 text-center text-xs text-mme-purple/45">
              © {new Date().getFullYear()} Make My Event Office Management
              System
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

export default RegisterPage;