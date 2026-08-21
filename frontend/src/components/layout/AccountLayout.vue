<template>
  <div class="min-h-screen bg-surface-hover/20 py-8">
    <div class="container-width">
      <div class="flex flex-col lg:flex-row gap-8">
        <!-- Sidebar Navigation -->
        <aside class="w-full lg:w-72 flex-shrink-0">
          <div
            class="overflow-hidden border border-border bg-card shadow-sm rounded-[var(--radius-container)] sticky top-24"
          >
            <AccountIconAndMenu
              variant="sidebar"
              :currentPath="currentPath"
              :onMenuItemClick="handleMenuItemClick"
              :onLogoutClick="handleLogout"
              :menuLinks="menuLinks"
              :labels="accountIconAndMenuLabels"
              :loginFormLabels="loginFormLabels"
            />
          </div>
        </aside>

        <!-- Main Content Area -->
        <div class="flex-1 min-w-0">
          <router-view />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useCompanyStore } from "@/stores/company";
import { useLanguageStore } from "@/stores/language";
import { localizeHref } from "@/lib/config";
import { AccountIconAndMenu } from '@propeller-commerce/propeller-v2-vue-ui';
import { useTranslations } from '@/lib/i18n/composable';

const accountIconAndMenuLabels = useTranslations('AccountIconAndMenu');
const loginFormLabels = useTranslations('LoginForm');
const t = useTranslations('Account');

const authStore = useAuthStore();
const companyStore = useCompanyStore();
const languageStore = useLanguageStore();
const router = useRouter();
const route = useRoute();

const currentPath = computed(() => "/" + route.path.replace(/^\//, ""));

// Delegate the auth-manager check to the auth store. The store reads the
// real SDK schema (purchaseAuthorizationConfigs.items[].purchaseRole) — the
// older local version checked non-existent `roles` / `companyRoles` fields
// and always returned false, hiding the manager-only menu items.
const isAuthManagerForCompany = computed(() =>
  authStore.isAuthManagerForCompany(
    authStore.user,
    companyStore.selectedCompany?.companyId,
  ),
);

// All hrefs go through localizeHref so they pick up the current language prefix
// (e.g. NL stays unprefixed, EN becomes "/en/account/..."). The computed depends
// on languageStore.language so the menu re-renders when the user switches.
const menuLinks = computed(() => {
  const lang = languageStore.language;
  return [
    { label: t.value.navDashboard, href: localizeHref("/account", lang) },
    { label: t.value.navAddresses, href: localizeHref("/account/addresses", lang) },
    { label: t.value.navOrders, href: localizeHref("/account/orders", lang) },
    { label: t.value.navQuotes, href: localizeHref("/account/quotes", lang) },
    { label: t.value.navQuoteRequests, href: localizeHref("/account/quote-requests", lang) },
    { label: t.value.navFavorites, href: localizeHref("/account/favorites", lang) },
    ...(isAuthManagerForCompany.value
      ? [
          {
            label: t.value.navAuthorizationSettings,
            href: localizeHref("/account/authorization-settings", lang),
          },
          {
            label: t.value.navAuthorizationRequests,
            href: localizeHref("/account/authorization-requests", lang),
          },
        ]
      : []),
  ];
});

function handleMenuItemClick(href: string) {
  // The href already carries the language prefix from menuLinks above, so
  // router.push receives the canonical path directly — no second wrap needed.
  router.push(href);
}

async function handleLogout() {
  await authStore.logout();
  router.push(localizeHref("/login", languageStore.language));
}
</script>
