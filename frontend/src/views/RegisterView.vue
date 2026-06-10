<template>
  <div class="min-h-[70vh] flex items-center justify-center py-12 px-4">
    <div class="w-full max-w-5xl">
      <RegisterForm
        :labels="registerFormLabels"
        :countries="COUNTRIES_MAP"
        :cart="cartStore.cart as Cart | null"
        :afterRegistration="
          (
            user: any,
            accessToken: any,
            refreshToken: any,
            expiresAt: any,
            anonymousCart: any,
          ) =>
            handleAfterRegistration(
              user,
              accessToken,
              refreshToken,
              expiresAt,
              anonymousCart,
            )
        "
        :onLoginClick="() => router.push(localizeHref('/login', languageStore.language))"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { CartService } from "@propeller-commerce/propeller-sdk-v2";
import type { Cart, Contact, Customer } from "@propeller-commerce/propeller-sdk-v2";
import { useAuthStore } from "@/stores/auth";
import { useCartStore } from "@/stores/cart";
import { useCompanyStore } from "@/stores/company";
import { useLanguageStore } from "@/stores/language";
import { graphqlClient } from "@/lib/api";
import { configuration, localizeHref } from "@/lib/config";
import { mergeAnonymousCart } from "propeller-v2-vue-ui";
import { useCart } from "propeller-v2-vue-ui";
import type { AnyUser } from "propeller-v2-vue-ui";
import { RegisterForm } from 'propeller-v2-vue-ui';
import { COUNTRIES_MAP } from "@/composables/shared/utils/countries";
import { useTranslations } from '@/lib/i18n/composable';

const router = useRouter();
const authStore = useAuthStore();
const registerFormLabels = useTranslations('RegisterForm');
const cartStore = useCartStore();
const companyStore = useCompanyStore();
const languageStore = useLanguageStore();

const { fetchActiveCart, resolveCart } = useCart({
  graphqlClient,
  user: computed(() => authStore.user as AnyUser),
  companyId: computed(
    () => companyStore.selectedCompany?.companyId ?? undefined,
  ),
  language: computed(() => languageStore.language),
  configuration,
});

async function handleAfterRegistration(
  user: Contact | Customer,
  accessToken?: string,
  refreshToken?: string,
  expiresAt?: string,
  anonymousCart?: Cart | null,
) {
  // No token means the form was used with `automaticLogin: false`. The user
  // exists server-side but isn't signed in here — send them to the login page.
  if (!accessToken) {
    router.push(localizeHref("/login", languageStore.language));
    return;
  }

  const cleanUser = user;
  authStore.setUser(cleanUser);
  authStore.setToken(accessToken);
  localStorage.setItem("accessToken", accessToken);
  if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
  if (expiresAt) localStorage.setItem("expiresAt", expiresAt);

  window.dispatchEvent(new CustomEvent("userLoggedIn"));

  const contactCompany = (cleanUser as Contact).company;
  if (contactCompany?.companyId) {
    companyStore.setSelectedCompany(contactCompany);
  }

  const userLang = (cleanUser as any).primaryLanguage;
  if (userLang && userLang !== languageStore.language) {
    languageStore.setLanguage(userLang);
  }

  let targetCart = await fetchActiveCart();

  if (anonymousCart?.items?.length) {
    if (!targetCart) {
      targetCart = await resolveCart();
    }
    const merged = await mergeAnonymousCart({
      graphqlClient,
      targetCartId: targetCart.cartId,
      anonymousCart,
      language: languageStore.language,
      imageSearchFilters: configuration.imageSearchFiltersGrid,
      imageVariantFilters: configuration.imageVariantFiltersSmall,
    });
    if (merged) targetCart = merged;

    if (anonymousCart.cartId && anonymousCart.cartId !== targetCart.cartId) {
      try {
        await new CartService(graphqlClient).deleteCart({
          id: anonymousCart.cartId,
        });
      } catch (e) {
        console.error("[auth] Failed to delete anonymous cart", e);
      }
    }
  }

  cartStore.setCart(targetCart ?? null);

  router.push(localizeHref("/account", userLang || languageStore.language));
}
</script>
