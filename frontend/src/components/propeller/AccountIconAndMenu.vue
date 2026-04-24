<template>
  <div
    class="propeller-account-menu relative"
    data-account-menu
    :data-variant="isSidebar ? 'sidebar' : 'dropdown'"
    :data-authenticated="user ? 'true' : 'false'"
    @click.stop
  >
    <template v-if="isSidebar">
      <div class="propeller-account-menu__sidebar flex flex-col">
        <template v-if="!!user">
          <div
            class="propeller-account-menu__user px-4 py-3 border-b border-border"
          >
            <p
              class="propeller-account-menu__user-label text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1"
            >
              {{ getLabel("signedInAs", "Signed in as") }}
            </p>
            <p
              class="propeller-account-menu__user-name font-medium text-foreground truncate"
            >
              {{ getUserName() }}
            </p>
          </div>
          <nav class="propeller-account-menu__nav py-2">
            <ul class="propeller-account-menu__list space-y-0.5">
              <template
                :key="link.href"
                v-for="(link, index) in getMenuLinks()"
              >
                <li class="propeller-account-menu__item">
                  <button
                    type="button"
                    @click="async (event) => handleMenuItemClick(link.href)"
                    :data-active="isActiveLink(link.href) ? 'true' : 'false'"
                    :class="`propeller-account-menu__link flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                      isActiveLink(link.href)
                        ? 'bg-secondary/5 text-secondary border-l-2 border-secondary'
                        : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'
                    }`"
                  >
                    {{ link.label }}
                  </button>
                </li>
              </template>
            </ul>
          </nav>
          <div
            class="propeller-account-menu__logout-wrapper px-4 py-3 border-t border-border"
          >
            <button
              type="button"
              class="propeller-account-menu__logout-btn flex w-full items-center gap-3 px-3 py-2 text-sm font-medium text-primary hover:bg-secondary/5 rounded-[var(--radius-control)] transition-colors"
              @click="async (event) => handleLogoutClick()"
            >
              {{ getLabel("logoutLabel", "Log Out") }}
            </button>
          </div>
        </template>
      </div>
    </template>

    <template v-if="!isSidebar">
      <button
        type="button"
        @click="handleIconClick"
        :aria-label="getLabel('accountLabel', 'Account')"
        :data-open="menuOpen ? 'true' : 'false'"
        :class="`propeller-account-menu__trigger inline-flex items-center gap-2 px-3 py-2 rounded-[var(--radius-control)] text-sm font-medium transition-colors text-white hover:bg-white/10${
          iconClassName ? ' ' + iconClassName : ''
        }`"
      >
        <svg
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          class="propeller-account-menu__icon w-5 h-5"
          :strokeWidth="1.5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
          ></path>
        </svg>
        <template v-if="isMounted">
          <template v-if="user">
            <span
              class="propeller-account-menu__greeting hidden md:block font-normal"
            >
              Hi, {{ getUserName() }}</span
            >
          </template>

          <template v-if="!user">
            <span
              class="propeller-account-menu__greeting hidden md:block font-normal"
              >{{ getLabel("accountLabel", "Account") }}</span
            >
          </template>
        </template>
      </button>

      <template v-if="menuOpen">
        <div
          :class="`propeller-account-menu__popover absolute right-0 top-full mt-1 w-80 bg-card text-foreground rounded-[var(--radius-container)] shadow-lg border border-border py-4 px-5 z-[9999]${
            menuClassName ? ' ' + menuClassName : ''
          }`"
        >
          <template v-if="isMounted">
            <template v-if="!!user">
              <div
                class="propeller-account-menu__user pb-3 mb-3 border-b border-border"
              >
                <p
                  class="propeller-account-menu__user-label text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1"
                >
                  {{ getLabel("signedInAs", "Signed in as") }}
                </p>
                <p
                  class="propeller-account-menu__user-name font-medium text-foreground truncate"
                >
                  {{ getUserName() }}
                </p>
              </div>
              <nav class="propeller-account-menu__nav">
                <ul class="propeller-account-menu__list space-y-0.5">
                  <template
                    :key="link.href"
                    v-for="(link, index) in getMenuLinks()"
                  >
                    <li class="propeller-account-menu__item">
                      <button
                        type="button"
                        class="propeller-account-menu__link flex w-full items-center gap-3 px-3 py-2 text-sm font-medium rounded-[var(--radius-control)] text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors"
                        @click="async (event) => handleMenuItemClick(link.href)"
                      >
                        {{ link.label }}
                      </button>
                    </li>
                  </template>
                </ul>
              </nav>
              <div
                class="propeller-account-menu__logout-wrapper mt-3 pt-3 border-t border-border"
              >
                <button
                  type="button"
                  class="propeller-account-menu__logout-btn flex w-full items-center gap-3 px-3 py-2 text-sm font-medium text-primary hover:bg-secondary/5 rounded-[var(--radius-control)] transition-colors"
                  @click="async (event) => handleLogoutClick()"
                >
                  {{ getLabel("logoutLabel", "Log Out") }}
                </button>
              </div>
            </template>

            <template v-if="!user">
              <template v-if="accountHeaderLoginForm !== false">
                <LoginForm
                  :graphqlClient="graphqlClient"
                  :title="
                    loginFormTitle ?? getLabel('loginTitle', 'Welcome Back')
                  "
                  :subtitle="loginFormSubtitle ?? getLabel('loginSubtitle', '')"
                  :buttonText="
                    loginButtonText ?? getLabel('loginButton', 'Log In')
                  "
                  :displayForgotPasswordLink="displayForgotPasswordLink"
                  :displayRegisterLink="displayRegisterLink"
                  :displayGuestCheckoutLink="displayGuestCheckoutLink"
                  :labels="labels"
                  :onLoginSubmit="onLoginSubmit"
                  :loginLoading="loginLoading"
                  :loginError="loginError"
                  :beforeLogin="beforeLogin"
                  :afterLogin="afterLogin"
                  :onForgotPasswordClick="
                    (event) => handleForgotPasswordClick()
                  "
                  :onRegisterClick="(event) => handleRegisterClick()"
                  :onGuestCheckoutClick="(event) => handleGuestCheckoutClick()"
                  :accountHeaderLoginForm="accountHeaderLoginForm"
                ></LoginForm>
              </template>

              <template v-if="accountHeaderLoginForm === false">
                <div class="propeller-account-menu__login-cta text-center py-4">
                  <h4
                    class="propeller-account-menu__login-title text-lg font-semibold mb-2"
                  >
                    {{ getMenuTitle() }}
                  </h4>
                  <p
                    class="propeller-account-menu__login-subtitle text-sm text-muted-foreground mb-4"
                  >
                    {{
                      getLabel("loginSubtitle", "Login to access your account")
                    }}
                  </p>
                  <button
                    type="button"
                    class="propeller-account-menu__login-btn w-full inline-flex justify-center items-center px-4 py-2 rounded-[var(--radius-control)] bg-secondary text-primary-foreground text-sm font-medium hover:bg-secondary/90 transition-colors"
                    @click="
                      async (event) => {
                        closeMenu();
                        if (onAccountIconClick) onAccountIconClick();
                      }
                    "
                  >
                    {{ getLabel("loginButton", "Log In") }}
                  </button>
                </div>
              </template>
            </template>
          </template>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";

import { Contact, Customer, GraphQLClient } from "propeller-sdk-v2";
import LoginForm from "./LoginForm.vue";
import { getLabel as _getLabel } from "../../composables/shared/utils/labelHelpers";

export interface AccountMenuLink {
  /** Display label for the link */
  label: string;
  /** URL path for the link */
  href: string;
  /** Optional icon name */
  icon?: string;
}
export interface AccountIconAndMenuProps {
  /**
   * Contact/Customer that this component will operate with.
   * When present, shows account navigation. When null, shows login form.
   */
  user?: Contact | Customer | null;

  /**
   * Icon for the account icon in header.
   * @default 'default-account-icon'
   */
  icon?: string;

  /**
   * Show account dropdown at the bottom of the icon when account icon is clicked.
   * If false, fires onAccountIconClick() instead.
   * @default true
   */
  showAccountMenuOnClick?: boolean;

  /**
   * Title for the account dropdown menu.
   * @default 'My account'
   */
  accountMenuTitle?: string;

  /**
   * Show login form in dropdown for immediate login when user is not logged in.
   * @default true
   */
  accountHeaderLoginForm?: boolean;

  // ── LoginForm pass-through props ────────────────────────────────────────

  /**
   * GraphQL client for self-contained login.
   * When provided (and onLoginSubmit is not), LoginForm handles authentication internally.
   */
  graphqlClient?: GraphQLClient;

  /**
   * Title displayed inside the login form.
   * @default 'Welcome Back'
   */
  loginFormTitle?: string;

  /** Subtitle displayed inside the login form. */
  loginFormSubtitle?: string;

  /**
   * Label for the login submit button.
   * @default 'Log In'
   */
  loginButtonText?: string;

  /**
   * Show/hide the forgot password link inside the login form.
   * @default true
   */
  displayForgotPasswordLink?: boolean;

  /**
   * Show/hide the register link inside the login form.
   * @default true
   */
  displayRegisterLink?: boolean;

  /**
   * Show/hide the guest checkout link inside the login form.
   * @default false
   */
  displayGuestCheckoutLink?: boolean;

  /** Fires when the guest checkout link is clicked. */
  onGuestCheckoutClick?: () => void;

  /**
   * Error message shown inside the login form.
   * Used in delegation mode (when onLoginSubmit is provided).
   */
  loginError?: string;

  /** Callback fired before the login process starts. */
  beforeLogin?: () => void;

  /**
   * Callback fired after successful self-contained login.
   * Not called in delegation mode — the parent handles the result there.
   */
  afterLogin?: (
    user: Contact | Customer,
    accessToken?: string,
    refreshToken?: string,
    expiresAt?: string,
  ) => void;

  // ── Existing callbacks ──────────────────────────────────────────────────

  /**
   * Fires when login form is submitted (delegation mode).
   * Parent should handle actual authentication.
   */
  onLoginSubmit?: (email: string, password: string) => void;

  /**
   * Fires when account icon is clicked and showAccountMenuOnClick is false.
   */
  onAccountIconClick?: () => void;

  /**
   * Fires when a menu item is clicked. Receives the href.
   */
  onMenuItemClick?: (href: string) => void;

  /**
   * Fires when logout is clicked.
   */
  onLogoutClick?: () => void;

  /**
   * Fires when "Forgot Password" link is clicked.
   */
  onForgotPasswordClick?: () => void;

  /**
   * Fires when "Register" link is clicked.
   */
  onRegisterClick?: () => void;

  /**
   * Whether login is currently in progress (shows loading state on button).
   * @default false
   */
  loginLoading?: boolean;

  /**
   * Account navigation links shown when user is authenticated.
   * @default [{ label: 'Dashboard', href: '/account' }, ...]
   */
  menuLinks?: AccountMenuLink[];

  /**
   * Labels for the component.
   * Available keys: accountLabel, loginTitle, loginSubtitle, signedInAs, logoutLabel.
   * LoginForm label keys are also forwarded: email, password, emailPlaceholder,
   * passwordPlaceholder, forgotPassword, registerText, registerLink, guestCheckoutLink.
   */
  labels?: Record<string, string>;

  /** Additional class name for the account icon button. */
  iconClassName?: string;

  /** Additional class name for the dropdown menu. */
  menuClassName?: string;

  /**
   * Component variant.
   * - 'dropdown' (default): Header icon with popup menu
   * - 'sidebar': Always-visible vertical navigation for account layout
   */
  variant?: "dropdown" | "sidebar";

  /**
   * Current route path, used in sidebar variant to highlight the active link.
   */
  currentPath?: string;
}
interface AccountIconAndMenuState {
  isMounted: boolean;
  menuOpen: boolean;
  isSidebar: boolean;
  getUserName: () => string;
  getLabel: (key: string, fallback: string) => string;
  getMenuTitle: () => string;
  getMenuLinks: () => AccountMenuLink[];
  isActiveLink: (href: string) => boolean;
  handleIconClick: () => void;
  handleMenuItemClick: (href: string) => void;
  handleLogoutClick: () => void;
  handleForgotPasswordClick: () => void;
  handleRegisterClick: () => void;
  handleGuestCheckoutClick: () => void;
  closeMenu: () => void;
}

const props = withDefaults(defineProps<AccountIconAndMenuProps>(), {
  showAccountMenuOnClick: true,
});
const isMounted = ref<AccountIconAndMenuState["isMounted"]>(false);
const menuOpen = ref<AccountIconAndMenuState["menuOpen"]>(false);
function _onDocumentClick() {
  menuOpen.value = false;
}
onMounted(() => document.addEventListener("click", _onDocumentClick));
onUnmounted(() => document.removeEventListener("click", _onDocumentClick));

onMounted(() => {
  isMounted.value = true;
});

const isSidebar = computed(() => {
  return props.variant === "sidebar";
});

watch(
  () => [props.user],
  () => {
    // Close menu when user logs in (user prop changes from null to truthy)
    if (props.user && menuOpen.value) {
      menuOpen.value = false;
    }
  },
  { immediate: true },
);
function getUserName(): ReturnType<AccountIconAndMenuState["getUserName"]> {
  const user = props.user as Contact | Customer;
  if (!user) return "";
  const parts = [user.firstName, user.lastName].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  if (user.firstName) return user.firstName;
  if (user.email) return user.email;
  return "User";
}
function getLabel(
  key: string,
  fallback: string,
): ReturnType<AccountIconAndMenuState["getLabel"]> {
  return _getLabel(props.labels, key, fallback);
}
function getMenuTitle(): ReturnType<AccountIconAndMenuState["getMenuTitle"]> {
  return (
    props.accountMenuTitle ||
    (props.labels as Record<string, string>)?.["accountMenuTitle"] ||
    "My account"
  );
}
function isActiveLink(
  href: string,
): ReturnType<AccountIconAndMenuState["isActiveLink"]> {
  if (!props.currentPath) return false;
  if (href.endsWith("/account")) return props.currentPath === href;
  return props.currentPath.startsWith(href);
}
function getMenuLinks(): ReturnType<AccountIconAndMenuState["getMenuLinks"]> {
  if (props.menuLinks && (props.menuLinks as AccountMenuLink[]).length > 0) {
    return props.menuLinks as AccountMenuLink[];
  }
  return [
    {
      label: "Dashboard",
      href: "/account",
    },
    {
      label: "Orders",
      href: "/account/orders",
    },
    {
      label: "Addresses",
      href: "/account/addresses",
    },
    {
      label: "Quotes",
      href: "/account/quotes",
    },
    {
      label: "Invoices",
      href: "/account/invoices",
    },
    {
      label: "Favorites",
      href: "/account/favorites",
    },
  ] as AccountMenuLink[];
}
function handleIconClick(): ReturnType<
  AccountIconAndMenuState["handleIconClick"]
> {
  console.log(
    "[AccountMenu] click, menuOpen was:",
    menuOpen.value,
    "showAccountMenuOnClick:",
    props.showAccountMenuOnClick,
  );
  if (props.showAccountMenuOnClick !== false) {
    menuOpen.value = !menuOpen.value;
    console.log("[AccountMenu] menuOpen is now:", menuOpen.value);
  } else {
    if (props.onAccountIconClick) props.onAccountIconClick();
  }
}
function handleMenuItemClick(
  href: string,
): ReturnType<AccountIconAndMenuState["handleMenuItemClick"]> {
  menuOpen.value = false;
  if (props.onMenuItemClick) props.onMenuItemClick(href);
}
function handleLogoutClick(): ReturnType<
  AccountIconAndMenuState["handleLogoutClick"]
> {
  menuOpen.value = false;
  if (props.onLogoutClick) props.onLogoutClick();
}
function handleForgotPasswordClick(): ReturnType<
  AccountIconAndMenuState["handleForgotPasswordClick"]
> {
  menuOpen.value = false;
  if (props.onForgotPasswordClick) props.onForgotPasswordClick();
}
function handleRegisterClick(): ReturnType<
  AccountIconAndMenuState["handleRegisterClick"]
> {
  menuOpen.value = false;
  if (props.onRegisterClick) props.onRegisterClick();
}
function handleGuestCheckoutClick(): ReturnType<
  AccountIconAndMenuState["handleGuestCheckoutClick"]
> {
  menuOpen.value = false;
  if (props.onGuestCheckoutClick) props.onGuestCheckoutClick();
}
function closeMenu(): ReturnType<AccountIconAndMenuState["closeMenu"]> {
  menuOpen.value = false;
}
</script>
