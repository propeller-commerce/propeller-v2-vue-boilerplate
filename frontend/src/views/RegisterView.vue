<template>
  <div class="min-h-[70vh] flex items-center justify-center py-12 px-4">
    <div class="w-full max-w-5xl">
      <RegisterForm
        :graphqlClient="graphqlClient"
        :language="languageStore.language"
        :countries="COUNTRIES_MAP"
        :onRegisterSuccess="handleRegisterSuccess"
        :onNavigateToLogin="() => router.push('/login')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import { useLanguageStore } from "@/stores/language";
import { graphqlClient } from "@/lib/api";
import RegisterForm from "@/components/propeller/RegisterForm.vue";
import { COUNTRIES_MAP } from "@/composables/shared/utils/countries";

const router = useRouter();
const languageStore = useLanguageStore();

function handleRegisterSuccess() {
  router.push("/login");
}
</script>
