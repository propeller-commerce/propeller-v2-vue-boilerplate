<template>
  <div class="propeller-forgot-password forgot-password-form" :data-loading="loading ? 'true' : 'false'" :data-submitted="submitted ? 'true' : 'false'">
    <template v-if="resolvedTitle">
      <div class="propeller-forgot-password__header space-y-1 text-center mb-6">
        <h2 class="propeller-forgot-password__title text-2xl font-bold">{{ resolvedTitle }}</h2>
        <template v-if="subtitle">
          <p class="propeller-forgot-password__subtitle text-sm text-muted-foreground">{{ subtitle }}</p>
        </template>
      </div>
    </template>

    <template v-if="!submitted">
      <form class="propeller-forgot-password__form space-y-4" @submit="async (e) => handleSubmit(e)">
        <div class="propeller-forgot-password__field space-y-2">
          <label for="forgot-password-email" class="propeller-forgot-password__label text-sm font-medium leading-none">{{
            emailLabel
          }}</label
          ><input
            type="email"
            id="forgot-password-email"
            name="email"
            class="propeller-forgot-password__input flex h-10 w-full rounded-[var(--radius-control)] border border-input bg-card px-3 py-2 text-sm placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
            :value="email"
            @change="
              async (e) => {
                email = e.target.value;
              }
            "
            :placeholder="emailPlaceholder"
            :required="true"
            :disabled="loading"
          />
        </div>
        <template v-if="error">
          <div class="text-sm text-destructive bg-destructive/10 p-3 rounded-[var(--radius-control)]">
            {{ error }}
          </div>
        </template>

        <button
          type="submit"
          class="propeller-forgot-password__submit inline-flex items-center justify-center w-full h-10 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-[var(--radius-control)] hover:bg-primary/80 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="loading"
        >
          <template v-if="loading">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              class="propeller-forgot-password__spinner animate-spin -ml-1 mr-2 h-4 w-4 text-primary-foreground"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                class="opacity-25"
              ></circle>
              <path
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                class="opacity-75"
              ></path>
            </svg>
          </template>

          <template v-if="loading"> Sending... </template>

          <template v-else>
            {{ resolvedButtonText }}
          </template>
        </button>
      </form>
    </template>

    <template v-if="submitted">
      <div class="propeller-forgot-password__success text-center space-y-4">
        <div class="flex justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
            class="propeller-forgot-password__success-icon h-12 w-12 text-success"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
        </div>
        <p class="propeller-forgot-password__success-message text-sm text-muted-foreground">{{ resolvedResponseMessage }}</p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { GraphQLClient } from 'propeller-sdk-v2';
import { useAuth } from '../../composables/useAuth';

export interface ForgotPasswordProps {
  /** GraphQL client for the Propeller SDK */
  graphqlClient: GraphQLClient;

  /** Title of the forgot password form
   * @default "Forgot password?"
   */
  title?: string;

  /** Subtitle of the forgot password form
   * @default ""
   */
  subtitle?: string;

  /** Label for the submit button
   * @default "Reset"
   */
  buttonText?: string;

  /** Message displayed after successful submission
   * @default "If an account exists with this email, you will receive a password reset link shortly."
   */
  responseMessage?: string;

  /**
   * Labels for the forgot password form fields.
   *
   * Available keys:
   * - email: Email field label (default: "Email")
   * - emailPlaceholder: Email input placeholder (default: "name@example.com")
   */
  labels?: Record<string, string>;

  /** Callback before the forgot password process starts */
  beforeForgotPassword?: () => void;

  /** Callback after the user has requested a password reset */
  afterForgotPassword?: (result: boolean) => void;
}

const props = defineProps<ForgotPasswordProps>();
const email = ref('');
const submitted = ref(false);

const { loading, error, forgotPassword } = useAuth({
  graphqlClient: props.graphqlClient,
});







const resolvedTitle = computed(() => {
  return props.title !== undefined ? props.title : 'Forgot password?';
});
const resolvedButtonText = computed(() => {
  return props.buttonText || 'Reset';
});
const resolvedResponseMessage = computed(() => {
  return props.responseMessage || 'If an account exists with this email, you will receive a password reset link shortly.';
});
const emailLabel = computed(() => {
  return props.labels?.email || 'Email';
});
const emailPlaceholder = computed(() => {
  return props.labels?.emailPlaceholder || 'name@example.com';
});

async function handleSubmit(e: any) {
  e.preventDefault();
  if (loading.value) return;
  if (props.beforeForgotPassword) {
    props.beforeForgotPassword();
  }
  const result = await forgotPassword(email.value);
  if (result.success) {
    submitted.value = true;
    if (props.afterForgotPassword) {
      props.afterForgotPassword(true);
    }
  } else {
    if (props.afterForgotPassword) {
      props.afterForgotPassword(false);
    }
  }
}
</script>
