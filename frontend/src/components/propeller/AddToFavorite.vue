<template>
  <template v-if="user">
    <div
      class="propeller-add-to-favorite relative inline-block"
      :data-favorited="isFavorited ? 'true' : 'false'"
    >
      <button
        type="button"
        @click="async (event) => toggleModal()"
        :title="
          isFavorited
            ? getLabel('removeFromFavorites', 'Remove from favorites')
            : getLabel('addToFavorites', 'Add to favorites')
        "
        :class="`propeller-add-to-favorite__btn inline-flex items-center justify-center rounded-[var(--radius-control)] border p-2.5 transition-colors ${
          isFavorited
            ? 'border-primary/30 bg-primary/5 text-primary hover:bg-primary/10'
            : 'border-border bg-card text-foreground-subtle hover:text-primary hover:border-primary/30 hover:bg-primary/5'
        } ${className || ''}`"
      >
        <template v-if="isFavorited">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path
              d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3.332.67-4.5 2.17C10.832 3.67 9.26 3 7.5 3A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
            ></path>
          </svg>
        </template>

        <template v-if="!isFavorited">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path
              d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3.332.67-4.5 2.17C10.832 3.67 9.26 3 7.5 3A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
            ></path>
          </svg>
        </template>
      </button>
      <template v-if="showModal && _isMounted">
        <div
          class="propeller-add-to-favorite__modal fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <div
            class="propeller-add-to-favorite__modal-content bg-card rounded-[var(--radius-container)] max-w-md w-full shadow-lg border"
          >
            <div
              class="propeller-add-to-favorite__modal-header flex justify-between items-center p-6 pb-4"
            >
              <h3
                class="propeller-add-to-favorite__modal-title text-xl font-bold"
              >
                {{ getLabel("modalTitle", "Favorite product?") }}
              </h3>
              <button
                type="button"
                class="propeller-add-to-favorite__modal-close h-8 w-8 p-0 inline-flex items-center justify-center rounded-[var(--radius-control)] text-muted-foreground hover:text-muted-foreground hover:bg-surface-hover"
                @click="async (event) => closeModal()"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18"></path>
                  <path d="m6 6 12 12"></path>
                </svg>
              </button>
            </div>
            <div
              class="propeller-add-to-favorite__modal-body px-6 pb-6 space-y-4"
            >
              <template v-if="getMemberLists().length > 0">
                <div class="propeller-add-to-favorite__member-lists space-y-2">
                  <template
                    :key="list.id"
                    v-for="(list, index) in getMemberLists()"
                  >
                    <button
                      type="button"
                      class="propeller-add-to-favorite__member-list-item flex items-center gap-2 py-2 w-full text-left hover:bg-surface-hover rounded-[var(--radius-control)] px-1 transition-colors disabled:opacity-50"
                      @click="
                        async (event) => handleRemoveFromList(String(list.id))
                      "
                      :disabled="removeLoading"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        class="text-primary flex-shrink-0"
                      >
                        <rect width="18" height="18" x="3" y="3" rx="2"></rect>
                        <path d="m9 12 2 2 4-4"></path></svg
                      ><span class="text-sm font-medium">{{ list.name }}</span>
                    </button> </template
                  ><button
                    type="button"
                    class="propeller-add-to-favorite__submit-btn w-full py-2.5 px-4 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/80 rounded-[var(--radius-control)] transition-colors disabled:opacity-50"
                    @click="
                      async (event) => {
                        const memberLists = getMemberLists();
                        if (memberLists.length > 0) {
                          handleRemoveFromList(String(memberLists[0].id));
                        }
                      }
                    "
                    :disabled="removeLoading"
                  >
                    <template v-if="removeLoading">
                      {{ getLabel("removing", "Removing...") }}
                    </template>

                    <template v-else>
                      {{
                        getLabel("removeFromFavorites", "Remove from favorites")
                      }}
                    </template>
                  </button>
                </div>
                <div
                  class="propeller-add-to-favorite__divider border-t border-border"
                ></div>
              </template>

              <template v-if="getNonMemberLists().length > 0">
                <div class="propeller-add-to-favorite__add-form space-y-3">
                  <div class="space-y-1">
                    <label
                      class="propeller-add-to-favorite__select-label text-xs text-muted-foreground"
                      >{{
                        getLabel("chooseList", "Choose a favorites list*")
                      }}</label
                    ><select
                      class="propeller-add-to-favorite__select block w-full rounded-[var(--radius-control)] border border-input px-3 py-2.5 text-sm focus:border-primary focus:ring-primary"
                      :value="selectedListId"
                      @change="
                        async (e) => {
                          selectedListId = e.target.value;
                        }
                      "
                    >
                      <template
                        :key="list.id"
                        v-for="(list, index) in getNonMemberLists()"
                      >
                        <option :value="String(list.id)">
                          {{ list.name }}
                        </option>
                      </template>
                    </select>
                  </div>
                  <button
                    type="button"
                    class="propeller-add-to-favorite__submit-btn w-full py-2.5 px-4 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/80 rounded-[var(--radius-control)] transition-colors disabled:opacity-50"
                    @click="async (event) => handleAddToList()"
                    :disabled="!selectedListId || addLoading"
                  >
                    <template v-if="addLoading">
                      {{ getLabel("adding", "Adding...") }}
                    </template>

                    <template v-else>
                      {{ getLabel("addToFavorites", "Add to favorites") }}
                    </template>
                  </button>
                </div>
              </template>

              <template
                v-if="
                  getMemberLists().length === 0 &&
                  getNonMemberLists().length === 0
                "
              >
                <div
                  class="propeller-add-to-favorite__empty py-4 text-center text-muted-foreground text-sm"
                >
                  {{
                    getLabel(
                      "noLists",
                      "You have no favorite lists. Create one in your account first.",
                    )
                  }}
                </div>
              </template>
            </div>
          </div>
        </div>
      </template>
    </div>
  </template>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";

import {
  FavoriteList,
  GraphQLClient,
  Contact,
  Customer,
} from "propeller-sdk-v2";
import { useFavorites } from "../../composables/useFavorites";
import { getLabel as _getLabel } from "../../composables/shared/utils/labelHelpers";

export interface AddToFavoriteProps {
  /** The initialized GraphQL Client instance */
  graphqlClient: GraphQLClient;

  /** The authenticated user */
  user: Contact | Customer | null;

  /** Product ID to add/remove from favorites (for products) */
  productId?: number;

  /** Cluster ID to add/remove from favorites (for clusters) */
  clusterId?: number;

  /** Extra CSS class applied to the root button */
  className?: string;

  /** UI string overrides */
  labels?: Record<string, string>;

  /** Called after a favorite list mutation (add/remove) succeeds */
  onFavoriteChanged?: () => void;
}
interface AddToFavoriteState {
  /** IDs of lists that contain this product/cluster (optimistic local tracking) */
  memberListIds: Set<string>;
  showModal: boolean;
  selectedListId: string;
  addLoading: boolean;
  removeLoading: boolean;
  _isMounted: boolean;
  isFavorited: boolean;
  isProduct: boolean;
  itemId: number;
  toggleModal: () => void;
  closeModal: () => void;
  handleAddToList: () => Promise<void>;
  handleRemoveFromList: (listId: string) => Promise<void>;
  getLabel: (key: string, fallback: string) => string;
  getMemberLists: () => FavoriteList[];
  getNonMemberLists: () => FavoriteList[];
}

const props = defineProps<AddToFavoriteProps>();

const userRef = computed(() => props.user ?? null);

const { addToList, removeFromList } = useFavorites({
  graphqlClient: props.graphqlClient,
  user: userRef,
});

const memberListIds = ref<AddToFavoriteState["memberListIds"]>(
  new Set<string>(),
);
const showModal = ref<AddToFavoriteState["showModal"]>(false);
const selectedListId = ref<AddToFavoriteState["selectedListId"]>("");
const addLoading = ref<AddToFavoriteState["addLoading"]>(false);
const removeLoading = ref<AddToFavoriteState["removeLoading"]>(false);
const _isMounted = ref<AddToFavoriteState["_isMounted"]>(false);

onMounted(() => {
  _isMounted.value = true;
});

const isFavorited = computed(() => {
  return memberListIds.value.size > 0;
});
const isProduct = computed(() => {
  return !!props.productId;
});
const itemId = computed(() => {
  return (props.productId || props.clusterId || 0) as number;
});

watch(
  () => [props.user, props.productId, props.clusterId],
  () => {
    if (!props.user || !itemId.value) return;
    const currentItemId = itemId.value;
    const currentIsProduct = isProduct.value;
    const userLists = (props.user as any)?.favoriteLists?.items as
      | FavoriteList[]
      | undefined;
    const memberIds = new Set<string>();
    (userLists || []).forEach((list: FavoriteList) => {
      const productsRef = list?.products as
        | {
            items?: {
              productId?: number;
              clusterId?: number;
            }[];
          }
        | undefined;
      const clustersRef = list?.clusters as
        | {
            items?: {
              clusterId?: number;
            }[];
          }
        | undefined;
      if (currentIsProduct) {
        if (productsRef?.items?.some((item) => item.productId === currentItemId)) {
          memberIds.add(String(list.id));
        }
      } else {
        const inProducts = productsRef?.items?.some(
          (item) => item.clusterId === currentItemId,
        );
        const inClusters = clustersRef?.items?.some(
          (item) => item.clusterId === currentItemId,
        );
        if (inProducts || inClusters) {
          memberIds.add(String(list.id));
        }
      }
    });
    memberListIds.value = memberIds;
  },
  { immediate: true },
);
function toggleModal(): ReturnType<AddToFavoriteState["toggleModal"]> {
  if (!props.user) return;
  if (!showModal.value) {
    const nonMember = getNonMemberLists();
    if (nonMember.length > 0 && !selectedListId.value) {
      selectedListId.value = String(nonMember[0].id);
    }
  }
  showModal.value = !showModal.value;
}
function closeModal(): ReturnType<AddToFavoriteState["closeModal"]> {
  showModal.value = false;
}
async function handleAddToList(): ReturnType<
  AddToFavoriteState["handleAddToList"]
> {
  if (!selectedListId.value || addLoading.value) return;
  addLoading.value = true;
  try {
    const pid = isProduct.value ? (itemId.value as number) : undefined;
    const cid = !isProduct.value ? (itemId.value as number) : undefined;
    await addToList(selectedListId.value, pid, cid);
    const newMemberIds = new Set(memberListIds.value);
    newMemberIds.add(String(selectedListId.value));
    memberListIds.value = newMemberIds;
    selectedListId.value = "";
    showModal.value = false;
    if (props.onFavoriteChanged) props.onFavoriteChanged();
  } catch (error) {
    console.error("Error adding to favorite list:", error);
  } finally {
    addLoading.value = false;
  }
}
async function handleRemoveFromList(
  listId: string,
): ReturnType<AddToFavoriteState["handleRemoveFromList"]> {
  if (removeLoading.value) return;
  removeLoading.value = true;
  try {
    const pid = isProduct.value ? (itemId.value as number) : undefined;
    const cid = !isProduct.value ? (itemId.value as number) : undefined;
    await removeFromList(listId, pid, cid);
    const newMemberIds = new Set(memberListIds.value);
    newMemberIds.delete(String(listId));
    memberListIds.value = newMemberIds;
    selectedListId.value = "";
    showModal.value = false;
    if (props.onFavoriteChanged) props.onFavoriteChanged();
  } catch (error) {
    console.error("Error removing from favorite list:", error);
  } finally {
    removeLoading.value = false;
  }
}
function getLabel(
  key: string,
  fallback: string,
): ReturnType<AddToFavoriteState["getLabel"]> {
  return _getLabel(props.labels, key, fallback);
}
function getMemberLists(): ReturnType<AddToFavoriteState["getMemberLists"]> {
  const userLists = (props.user as any)?.favoriteLists?.items as
    | FavoriteList[]
    | undefined;
  return (userLists || []).filter((list: FavoriteList) =>
    memberListIds.value.has(String(list.id)),
  );
}
function getNonMemberLists(): ReturnType<
  AddToFavoriteState["getNonMemberLists"]
> {
  const userLists = (props.user as any)?.favoriteLists?.items as
    | FavoriteList[]
    | undefined;
  return (userLists || []).filter(
    (list: FavoriteList) => !memberListIds.value.has(String(list.id)),
  );
}
</script>
