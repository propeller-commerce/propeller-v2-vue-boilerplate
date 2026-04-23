<template>
  <div
    class="propeller-register-form"
    :data-loading="loading ? 'true' : 'false'"
    :data-user-type="selectedUserType"
  >
    <template v-if="resolvedTitle">
      <div class="propeller-register-form__header space-y-1 text-center mb-6">
        <h2 class="propeller-register-form__title text-2xl font-bold">{{ resolvedTitle }}</h2>
        <template v-if="subtitle">
          <p class="propeller-register-form__subtitle text-sm text-gray-500">{{ subtitle }}</p>
        </template>
      </div>
    </template>

    <template v-if="!submitted">
      <form class="space-y-6" @submit="async (e) => handleSubmit(e)">
        <div class="space-y-4">
          <h3 class="text-lg font-semibold border-b pb-2">
            {{ personalDetailsTitle }}
          </h3>
          <template v-if="showUserTypeSelector">
            <div class="space-y-2">
              <label class="text-sm font-medium leading-none">{{ userTypeLabel }}</label>
              <div class="flex gap-3">
                <button
                  type="button"
                  @click="
                    async (event) => {
                      selectedUserType = 'Contact';
                    }
                  "
                  :class="
                    'flex-1 h-10 px-4 py-2 text-sm font-medium rounded-md border transition-colors ' +
                    (selectedUserType === 'Contact'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-gray-300 hover:bg-gray-50')
                  "
                >
                  {{ contactLabel }}</button
                ><button
                  type="button"
                  @click="
                    async (event) => {
                      selectedUserType = 'Customer';
                    }
                  "
                  :class="
                    'flex-1 h-10 px-4 py-2 text-sm font-medium rounded-md border transition-colors ' +
                    (selectedUserType === 'Customer'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-gray-300 hover:bg-gray-50')
                  "
                >
                  {{ customerLabel }}
                </button>
              </div>
            </div>
          </template>

          <div class="space-y-2">
            <label class="text-sm font-medium leading-none">{{ genderLabel }}</label>
            <div class="flex gap-4">
              <label class="flex items-center gap-2 text-sm"
                ><input
                  type="radio"
                  name="gender"
                  value="M"
                  class="propeller-register-form__radio h-4 w-4 border-gray-300 text-primary focus:ring-primary"
                  :checked="gender === Enums.Gender.M"
                  @change="
                    async (event) => {
                      gender = Enums.Gender.M;
                    }
                  "
                  :disabled="loading"
                />
                Mr. </label
              ><label class="flex items-center gap-2 text-sm"
                ><input
                  type="radio"
                  name="gender"
                  value="F"
                  class="propeller-register-form__radio h-4 w-4 border-gray-300 text-primary focus:ring-primary"
                  :checked="gender === Enums.Gender.F"
                  @change="
                    async (event) => {
                      gender = Enums.Gender.F;
                    }
                  "
                  :disabled="loading"
                />
                Mrs. </label
              ><label class="flex items-center gap-2 text-sm"
                ><input
                  type="radio"
                  name="gender"
                  value="U"
                  class="propeller-register-form__radio h-4 w-4 border-gray-300 text-primary focus:ring-primary"
                  :checked="gender === Enums.Gender.U"
                  @change="
                    async (event) => {
                      gender = Enums.Gender.U;
                    }
                  "
                  :disabled="loading"
                />
                Other
              </label>
            </div>
          </div>
          <div class="space-y-2">
            <label for="register-email" class="text-sm font-medium leading-none"
              >{{ emailLabel }}<span class="propeller-register-form__required text-red-500 ml-1">*</span></label
            ><input
              type="email"
              id="register-email"
              name="email"
              class="propeller-register-form__input flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
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
          <template v-if="isContact">
            <div class="space-y-4">
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-2">
                  <label for="register-vatNumber" class="text-sm font-medium leading-none"
                    >{{ vatNumberLabel }}
                    <template v-if="isFieldRequired('vatNumber')">
                      <span class="propeller-register-form__required text-red-500 ml-1">*</span>
                    </template> </label
                  ><input
                    type="text"
                    id="register-vatNumber"
                    name="vatNumber"
                    class="propeller-register-form__input flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
                    :value="vatNumber"
                    @change="
                      async (e) => {
                        vatNumber = e.target.value;
                      }
                    "
                    :required="isFieldRequired('vatNumber')"
                    :disabled="loading"
                  />
                </div>
                <div class="space-y-2">
                  <label for="register-cocNumber" class="text-sm font-medium leading-none"
                    >{{ cocNumberLabel }}
                    <template v-if="isFieldRequired('cocNumber')">
                      <span class="propeller-register-form__required text-red-500 ml-1">*</span>
                    </template> </label
                  ><input
                    type="text"
                    id="register-cocNumber"
                    name="cocNumber"
                    class="propeller-register-form__input flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
                    :value="cocNumber"
                    @change="
                      async (e) => {
                        cocNumber = e.target.value;
                      }
                    "
                    :required="isFieldRequired('cocNumber')"
                    :disabled="loading"
                  />
                </div>
              </div>
              <div class="space-y-2">
                <label for="register-companyName" class="text-sm font-medium leading-none"
                  >{{ companyNameLabel }}
                  <template v-if="isFieldRequired('companyName')">
                    <span class="propeller-register-form__required text-red-500 ml-1">*</span>
                  </template> </label
                ><input
                  type="text"
                  id="register-companyName"
                  name="companyName"
                  class="propeller-register-form__input flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
                  :value="companyName"
                  @change="
                    async (e) => {
                      companyName = e.target.value;
                    }
                  "
                  :required="isFieldRequired('companyName')"
                  :disabled="loading"
                />
              </div>
            </div>
          </template>

          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-2">
              <label for="register-firstName" class="text-sm font-medium leading-none"
                >{{ firstNameLabel }}<span class="propeller-register-form__required text-red-500 ml-1">*</span></label
              ><input
                type="text"
                id="register-firstName"
                name="firstName"
                class="propeller-register-form__input flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
                :value="firstName"
                @change="
                  async (e) => {
                    firstName = e.target.value;
                  }
                "
                :required="true"
                :disabled="loading"
              />
            </div>
            <div class="space-y-2">
              <label for="register-middleName" class="text-sm font-medium leading-none">{{
                middleNameLabel
              }}</label
              ><input
                type="text"
                id="register-middleName"
                name="middleName"
                class="propeller-register-form__input flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
                :value="middleName"
                @change="
                  async (e) => {
                    middleName = e.target.value;
                  }
                "
                :disabled="loading"
              />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-2">
              <label for="register-lastName" class="text-sm font-medium leading-none"
                >{{ lastNameLabel }}<span class="propeller-register-form__required text-red-500 ml-1">*</span></label
              ><input
                type="text"
                id="register-lastName"
                name="lastName"
                class="propeller-register-form__input flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
                :value="lastName"
                @change="
                  async (e) => {
                    lastName = e.target.value;
                  }
                "
                :required="true"
                :disabled="loading"
              />
            </div>
            <div class="space-y-2">
              <label for="register-phone" class="text-sm font-medium leading-none"
                >{{ phoneLabel }}
                <template v-if="isFieldRequired('phone')">
                  <span class="propeller-register-form__required text-red-500 ml-1">*</span>
                </template> </label
              ><input
                type="tel"
                id="register-phone"
                name="phone"
                class="propeller-register-form__input flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
                :value="phone"
                @change="
                  async (e) => {
                    phone = e.target.value;
                  }
                "
                :required="isFieldRequired('phone')"
                :disabled="loading"
              />
            </div>
          </div>
        </div>
        <div class="space-y-4">
          <h3 class="text-lg font-semibold border-b pb-2">
            {{ billingAddressTitle }}
          </h3>
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-2">
              <label for="register-billingPostalCode" class="text-sm font-medium leading-none"
                >{{ postalCodeLabel }}<span class="propeller-register-form__required text-red-500 ml-1">*</span></label
              ><input
                type="text"
                id="register-billingPostalCode"
                name="billingPostalCode"
                class="propeller-register-form__input flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
                :value="billingPostalCode"
                @change="
                  async (e) => {
                    billingPostalCode = e.target.value;
                  }
                "
                :required="true"
                :disabled="loading"
              />
            </div>
            <div class="space-y-2">
              <label for="register-billingStreet" class="text-sm font-medium leading-none"
                >{{ streetLabel }}<span class="propeller-register-form__required text-red-500 ml-1">*</span></label
              ><input
                type="text"
                id="register-billingStreet"
                name="billingStreet"
                class="propeller-register-form__input flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
                :value="billingStreet"
                @change="
                  async (e) => {
                    billingStreet = e.target.value;
                  }
                "
                :required="true"
                :disabled="loading"
              />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-2">
              <label for="register-billingNumber" class="text-sm font-medium leading-none"
                >{{ numberLabel }}<span class="propeller-register-form__required text-red-500 ml-1">*</span></label
              ><input
                type="text"
                id="register-billingNumber"
                name="billingNumber"
                class="propeller-register-form__input flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
                :value="billingNumber"
                @change="
                  async (e) => {
                    billingNumber = e.target.value;
                  }
                "
                :required="true"
                :disabled="loading"
              />
            </div>
            <div class="space-y-2">
              <label
                for="register-billingNumberExtension"
                class="text-sm font-medium leading-none"
                >{{ numberExtensionLabel }}</label
              ><input
                type="text"
                id="register-billingNumberExtension"
                name="billingNumberExtension"
                class="propeller-register-form__input flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
                :value="billingNumberExtension"
                @change="
                  async (e) => {
                    billingNumberExtension = e.target.value;
                  }
                "
                :disabled="loading"
              />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-2">
              <label for="register-billingCity" class="text-sm font-medium leading-none"
                >{{ cityLabel }}<span class="propeller-register-form__required text-red-500 ml-1">*</span></label
              ><input
                type="text"
                id="register-billingCity"
                name="billingCity"
                class="propeller-register-form__input flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
                :value="billingCity"
                @change="
                  async (e) => {
                    billingCity = e.target.value;
                  }
                "
                :required="true"
                :disabled="loading"
              />
            </div>
            <div class="space-y-2">
              <label for="register-billingCountry" class="text-sm font-medium leading-none"
                >{{ countryLabel }}<span class="propeller-register-form__required text-red-500 ml-1">*</span></label
              ><select
                id="register-billingCountry"
                name="billingCountry"
                class="propeller-register-form__input flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
                :value="billingCountry"
                @change="
                  async (e) => {
                    billingCountry = e.target.value;
                  }
                "
                :required="true"
                :disabled="loading"
              >
                <option value="">Select country</option>
                <template :key="entry[0]" v-for="(entry, index) in Object.entries(countries || {})">
                  <option :value="entry[0]">{{ entry[1] }}</option>
                </template>
              </select>
            </div>
          </div>
        </div>
        <div class="space-y-4">
          <h3 class="text-lg font-semibold border-b pb-2">
            {{ deliveryAddressTitle }}
          </h3>
          <div class="flex items-center gap-2">
            <input
              type="checkbox"
              id="register-sameAsDelivery"
              name="sameAsDelivery"
              class="propeller-register-form__checkbox h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              :checked="sameAsDelivery"
              @change="
                async (e) => {
                  sameAsDelivery = e.target.checked;
                }
              "
              :disabled="loading"
            /><label for="register-sameAsDelivery" class="text-sm font-medium leading-none">{{
              sameAsDeliveryLabel
            }}</label>
          </div>
          <template v-if="!sameAsDelivery">
            <div class="space-y-4">
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-2">
                  <label for="register-deliveryPostalCode" class="text-sm font-medium leading-none"
                    >{{ postalCodeLabel }}<span class="propeller-register-form__required text-red-500 ml-1">*</span></label
                  ><input
                    type="text"
                    id="register-deliveryPostalCode"
                    name="deliveryPostalCode"
                    class="propeller-register-form__input flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
                    :value="deliveryPostalCode"
                    @change="
                      async (e) => {
                        deliveryPostalCode = e.target.value;
                      }
                    "
                    :required="true"
                    :disabled="loading"
                  />
                </div>
                <div class="space-y-2">
                  <label for="register-deliveryStreet" class="text-sm font-medium leading-none"
                    >{{ streetLabel }}<span class="propeller-register-form__required text-red-500 ml-1">*</span></label
                  ><input
                    type="text"
                    id="register-deliveryStreet"
                    name="deliveryStreet"
                    class="propeller-register-form__input flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
                    :value="deliveryStreet"
                    @change="
                      async (e) => {
                        deliveryStreet = e.target.value;
                      }
                    "
                    :required="true"
                    :disabled="loading"
                  />
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-2">
                  <label for="register-deliveryNumber" class="text-sm font-medium leading-none"
                    >{{ numberLabel }}<span class="propeller-register-form__required text-red-500 ml-1">*</span></label
                  ><input
                    type="text"
                    id="register-deliveryNumber"
                    name="deliveryNumber"
                    class="propeller-register-form__input flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
                    :value="deliveryNumber"
                    @change="
                      async (e) => {
                        deliveryNumber = e.target.value;
                      }
                    "
                    :required="true"
                    :disabled="loading"
                  />
                </div>
                <div class="space-y-2">
                  <label
                    for="register-deliveryNumberExtension"
                    class="text-sm font-medium leading-none"
                    >{{ numberExtensionLabel }}</label
                  ><input
                    type="text"
                    id="register-deliveryNumberExtension"
                    name="deliveryNumberExtension"
                    class="propeller-register-form__input flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
                    :value="deliveryNumberExtension"
                    @change="
                      async (e) => {
                        deliveryNumberExtension = e.target.value;
                      }
                    "
                    :disabled="loading"
                  />
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-2">
                  <label for="register-deliveryCity" class="text-sm font-medium leading-none"
                    >{{ cityLabel }}<span class="propeller-register-form__required text-red-500 ml-1">*</span></label
                  ><input
                    type="text"
                    id="register-deliveryCity"
                    name="deliveryCity"
                    class="propeller-register-form__input flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
                    :value="deliveryCity"
                    @change="
                      async (e) => {
                        deliveryCity = e.target.value;
                      }
                    "
                    :required="true"
                    :disabled="loading"
                  />
                </div>
                <div class="space-y-2">
                  <label for="register-deliveryCountry" class="text-sm font-medium leading-none"
                    >{{ countryLabel }}<span class="propeller-register-form__required text-red-500 ml-1">*</span></label
                  ><select
                    id="register-deliveryCountry"
                    name="deliveryCountry"
                    class="propeller-register-form__input flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
                    :value="deliveryCountry"
                    @change="
                      async (e) => {
                        deliveryCountry = e.target.value;
                      }
                    "
                    :required="true"
                    :disabled="loading"
                  >
                    <option value="">Select country</option>
                    <template
                      :key="entry[0]"
                      v-for="(entry, index) in Object.entries(countries || {})"
                    >
                      <option :value="entry[0]">{{ entry[1] }}</option>
                    </template>
                  </select>
                </div>
              </div>
            </div>
          </template>
        </div>
        <div class="space-y-4">
          <h3 class="text-lg font-semibold border-b pb-2">
            {{ passwordTitle }}
          </h3>
          <div class="space-y-2">
            <label for="register-password" class="text-sm font-medium leading-none"
              >{{ passwordLabel }}<span class="propeller-register-form__required text-red-500 ml-1">*</span></label
            ><input
              type="password"
              id="register-password"
              name="password"
              class="propeller-register-form__input flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
              :value="password"
              @change="
                async (e) => {
                  password = e.target.value;
                }
              "
              :placeholder="passwordPlaceholder"
              :required="true"
              :disabled="loading"
            />
          </div>
          <div class="space-y-2">
            <label for="register-confirmPassword" class="text-sm font-medium leading-none"
              >{{ confirmPasswordLabel }}<span class="propeller-register-form__required text-red-500 ml-1">*</span></label
            ><input
              type="password"
              id="register-confirmPassword"
              name="confirmPassword"
              class="propeller-register-form__input flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
              :value="confirmPassword"
              @change="
                async (e) => {
                  confirmPassword = e.target.value;
                }
              "
              :placeholder="passwordPlaceholder"
              :required="true"
              :disabled="loading"
            />
          </div>
        </div>
        <template v-if="error">
          <div class="propeller-register-form__error text-sm text-red-600 bg-red-50 p-3 rounded-md">
            {{ error }}
          </div>
        </template>

        <button
          type="submit"
          class="propeller-register-form__submit inline-flex items-center justify-center w-full h-10 px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/80 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="loading"
        >
          <template v-if="loading">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              class="propeller-register-form__spinner animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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

          <template v-if="loading"> Registering... </template>

          <template v-else>
            {{ resolvedButtonText }}
          </template>
        </button>
      </form>
    </template>

    <template v-if="submitted">
      <div class="text-center space-y-4">
        <div class="flex justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
            class="propeller-register-form__success-icon h-12 w-12 text-green-500"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
        </div>
        <p class="propeller-register-form__success-message text-sm text-gray-600">Your account has been created successfully.</p>
      </div>
    </template>

    <template v-if="showLoginLink && !submitted">
      <div class="mt-6 border-t pt-6">
        <div class="text-center">
          <p class="propeller-register-form__login-prompt text-sm text-gray-500 mb-2">{{ loginText }}</p>
          <button
            type="button"
            class="text-sm text-primary hover:underline"
            @click="
              async (event) => {
                if (onLoginClick) onLoginClick();
              }
            "
          >
            {{ loginLinkText }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Enums } from 'propeller-sdk-v2';
import type { Contact, Customer, GraphQLClient } from 'propeller-sdk-v2';
import { useAuth } from '../../composables/useAuth';
import type { RegisterContactInput, RegisterCustomerInput } from '../../composables/useAuth';




     export interface RegisterFormProps {
 /** GraphQL client for the Propeller SDK */
 graphqlClient: GraphQLClient;

 /** Title of the register form
  * @default "Create account"
  */
 title?: string;

 /** Subtitle of the register form
  * @default ""
  */
 subtitle?: string;

 /** Label for the submit button
  * @default "Register"
  */
 buttonText?: string;

 /**
  * Enable choosing between Contact or Customer if null,
  * otherwise proceed with one user type registration only.
  * 'Contact' = Company account (has company name, VAT, CoC fields)
  * 'Customer' = Consumer/personal account
  * @default null
  */
 showUserType?: 'Contact' | 'Customer' | null;

 /**
  * Required fields for the registration form.
  * Available field names: firstName, middleName, lastName, email, password,
  * phone, mobile, gender, companyName, vatNumber, cocNumber,
  * street, number, numberExtension, postalCode, city, country
  * @default []
  */
 requiredFields?: string[];

 /**
  * Contact or Customer is automatically logged in upon registration.
  * @default true
  */
 automaticLogin?: boolean;

 /**
  * Labels for the registration form fields.
  *
  * Available keys:
  * - firstName, middleName, lastName, email, password, confirmPassword
  * - phone, gender, companyName, vatNumber, cocNumber
  * - street, number, numberExtension, postalCode, city, country
  * - userTypeLabel, contactLabel, customerLabel
  * - emailPlaceholder, passwordPlaceholder, passwordMismatch
  * - billingAddressTitle, deliveryAddressTitle, sameAsDelivery
  * - loginText, loginLink
  * - personalDetailsTitle, passwordTitle
  */
 labels?: Record<string, string>;

 /** Callback before the registration process starts */
 beforeRegistration?: () => void;

 /** Callback after the user is registered */
 afterRegistration?: (user: Contact | Customer, accessToken?: string, refreshToken?: string, expiresAt?: string) => void;

 /** Action for the login link click */
 onLoginClick?: () => void;

 /** Show/hide the login link
  * @default true
  */
 displayLoginLink?: boolean;

 /**
  * Prefered language
  * @default 'NL'
  */
 preferredLanguage?: string;

 /**
  * List of countries to display in the country dropdown
  * @default {}
  */
 countries?: Record<string, string>;
}
const props = withDefaults(defineProps<RegisterFormProps>(), {
  automaticLogin: true,
  displayLoginLink: true,
});
const firstName = ref('');
const middleName = ref('');
const lastName = ref('');
const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const phone = ref('');
const gender = ref<Enums.Gender>(Enums.Gender.U);
const companyName = ref('');
const vatNumber = ref('');
const cocNumber = ref('');
const billingStreet = ref('');
const billingNumber = ref('');
const billingNumberExtension = ref('');
const billingPostalCode = ref('');
const billingCity = ref('');
const billingCountry = ref('');
const sameAsDelivery = ref(true);
const deliveryStreet = ref('');
const deliveryNumber = ref('');
const deliveryNumberExtension = ref('');
const deliveryPostalCode = ref('');
const deliveryCity = ref('');
const deliveryCountry = ref('');
const selectedUserType = ref<'' | 'Contact' | 'Customer'>('');
const submitted = ref(false);

const { loading, error, registerContact, registerCustomer } = useAuth({
  graphqlClient: props.graphqlClient,
  language: props.preferredLanguage || 'NL',
});










  const resolvedTitle = computed(() => {
return props.title !== undefined ? props.title : 'Create account';
})
const resolvedButtonText = computed(() => {
return props.buttonText || 'Register';
})
const showUserTypeSelector = computed(() => {
return props.showUserType === undefined || props.showUserType === null;
})
const effectiveUserType = computed(() => {
if (props.showUserType) return props.showUserType;
return selectedUserType.value;
})
const isContact = computed(() => {
  return effectiveUserType.value === 'Contact';
});
const isCustomer = computed(() => {
  return effectiveUserType.value === 'Customer';
});
const showLoginLink = computed(() => {
return props.displayLoginLink !== false;
})
const personalDetailsTitle = computed(() => {
return props.labels?.personalDetailsTitle || 'Your details';
})
const billingAddressTitle = computed(() => {
return props.labels?.billingAddressTitle || 'Billing address';
})
const deliveryAddressTitle = computed(() => {
return props.labels?.deliveryAddressTitle || 'Delivery address';
})
const passwordTitle = computed(() => {
return props.labels?.passwordTitle || 'Password';
})
const sameAsDeliveryLabel = computed(() => {
  return props.labels?.sameAsDelivery || 'Delivery address is the same as billing address';
});
const firstNameLabel = computed(() => {
  return props.labels?.firstName || 'First name';
});
const middleNameLabel = computed(() => {
  return props.labels?.middleName || 'Insertion';
});
const lastNameLabel = computed(() => {
  return props.labels?.lastName || 'Last name';
});
const emailLabel = computed(() => {
  return props.labels?.email || 'Email address';
});
const passwordLabel = computed(() => {
  return props.labels?.password || 'Password';
});
const confirmPasswordLabel = computed(() => {
  return props.labels?.confirmPassword || 'Repeat password';
});
const phoneLabel = computed(() => {
  return props.labels?.phone || 'Phone number';
});
const genderLabel = computed(() => {
  return props.labels?.gender || 'Title';
});
const companyNameLabel = computed(() => {
  return props.labels?.companyName || 'Company name';
});
const vatNumberLabel = computed(() => {
  return props.labels?.vatNumber || 'VAT number';
});
const cocNumberLabel = computed(() => {
  return props.labels?.cocNumber || 'CoC number';
});
const streetLabel = computed(() => {
return props.labels?.street || 'Street';
})
const numberLabel = computed(() => {
return props.labels?.number || 'Number';
})
const numberExtensionLabel = computed(() => {
return props.labels?.numberExtension || 'Apt/Suite/Unit';
})
const postalCodeLabel = computed(() => {
return props.labels?.postalCode || 'Postal code';
})
const cityLabel = computed(() => {
return props.labels?.city || 'City';
})
const countryLabel = computed(() => {
return props.labels?.country || 'Country';
})
const userTypeLabel = computed(() => {
return props.labels?.userTypeLabel || 'Account type';
})
const contactLabel = computed(() => {
return props.labels?.contactLabel || 'Company';
})
const customerLabel = computed(() => {
return props.labels?.customerLabel || 'Consumer';
})
const emailPlaceholder = computed(() => {
return props.labels?.emailPlaceholder || 'name@example.com';
})
const passwordPlaceholder = computed(() => {
return props.labels?.passwordPlaceholder || '••••••••';
})
const passwordMismatchText = computed(() => {
return props.labels?.passwordMismatch || 'Passwords do not match';
})
const loginText = computed(() => {
return props.labels?.loginText || 'Already have an account?';
})
const loginLinkText = computed(() => {
return props.labels?.loginLink || 'Log in';
})




function isFieldRequired(fieldName: string): boolean {
  if (fieldName === 'companyName' && isContact.value) return true;
  if (!props.requiredFields) return false;
  return props.requiredFields.indexOf(fieldName) !== -1;
}
async function handleSubmit(e: Event | any) {
  e.preventDefault();
  if (!effectiveUserType.value) {
    error.value = 'Please select an account type.';
    return;
  }
  if (password.value !== confirmPassword.value) {
    error.value = passwordMismatchText.value;
    return;
  }
  if (loading.value) return;
  if (props.beforeRegistration) {
    props.beforeRegistration();
  }

  const input = {
    email: email.value,
    password: password.value,
    firstName: firstName.value,
    middleName: middleName.value,
    lastName: lastName.value,
    phone: phone.value,
    gender: gender.value,
    companyName: companyName.value,
    vatNumber: vatNumber.value,
    cocNumber: cocNumber.value,
    street: billingStreet.value,
    number: billingNumber.value,
    numberExtension: billingNumberExtension.value,
    postalCode: billingPostalCode.value,
    city: billingCity.value,
    country: billingCountry.value,
    deliveryStreet: deliveryStreet.value,
    deliveryNumber: deliveryNumber.value,
    deliveryPostalCode: deliveryPostalCode.value,
    deliveryCity: deliveryCity.value,
    deliveryCountry: deliveryCountry.value,
    sameDeliveryAsBilling: sameAsDelivery.value,
  };

  const result = isContact.value
    ? await registerContact(input as RegisterContactInput)
    : await registerCustomer(input as RegisterCustomerInput);

  if (result.success && result.user) {
    submitted.value = true;
    if (props.afterRegistration) {
      props.afterRegistration(
        result.user as Contact | Customer,
        result.accessToken,
        result.refreshToken,
        result.expiresAt
      );
    }
  }
}
</script>
