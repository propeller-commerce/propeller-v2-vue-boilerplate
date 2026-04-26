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
              :user="authStore.user ?? null"
              :onMenuItemClick="handleMenuItemClick"
              :onLogoutClick="handleLogout"
              :menuLinks="menuLinks"
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
import AccountIconAndMenu from "@/components/propeller/AccountIconAndMenu.vue";

const authStore = useAuthStore();
const companyStore = useCompanyStore();
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

const menuLinks = computed(() => [
  { label: "Dashboard", href: "/account" },
  { label: "Addresses", href: "/account/addresses" },
  { label: "Orders", href: "/account/orders" },
  { label: "Quotes", href: "/account/quotes" },
  { label: "Quote requests", href: "/account/quote-requests" },
  { label: "Favorites", href: "/account/favorites" },
  ...(isAuthManagerForCompany.value
    ? [
        {
          label: "Authorization settings",
          href: "/account/authorization-settings",
        },
        {
          label: "Authorization requests",
          href: "/account/authorization-requests",
        },
      ]
    : []),
]);

function handleMenuItemClick(href: string) {
  router.push(href);
}

async function handleLogout() {
  await authStore.logout();
  router.push("/login");
}
</script>
