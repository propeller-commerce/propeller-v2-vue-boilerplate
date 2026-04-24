<template>
  <div
    :class="`propeller-favorite-lists ${className || ''}`"
    :data-loading="loading ? 'true' : 'false'"
  >
    <template
      v-if="
        allowFavoriteListCreate !== false &&
        !loading &&
        isMounted &&
        displayedLists.length > 0
      "
    >
      <div class="propeller-favorite-lists__toolbar flex justify-end mb-4">
        <button
          class="propeller-favorite-lists__create-btn inline-flex items-center px-4 py-2 text-sm font-medium rounded-[var(--radius-control)] text-primary-foreground bg-primary hover:bg-primary/80"
          @click="
            async (event) => {
              showCreateModal = true;
            }
          "
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            class="mr-2"
          >
            <path d="M5 12h14"></path>
            <path d="M12 5v14"></path></svg
          >{{ getLabel("createButton", "Create New List") }}
        </button>
      </div>
    </template>

    <template v-if="loading">
      <div class="space-y-4">
        <div
          class="propeller-favorite-lists__skeleton border border-border rounded-[var(--radius-container)] p-6 animate-pulse"
        >
          <div class="flex justify-between items-start">
            <div class="space-y-2 flex-1">
              <div class="h-6 w-1/3 bg-surface-hover rounded"></div>
              <div class="h-4 w-1/4 bg-surface-hover rounded"></div>
              <div class="h-4 w-1/2 bg-surface-hover rounded"></div>
            </div>
          </div>
        </div>
        <div
          class="propeller-favorite-lists__skeleton border border-border rounded-[var(--radius-container)] p-6 animate-pulse"
        >
          <div class="flex justify-between items-start">
            <div class="space-y-2 flex-1">
              <div class="h-6 w-1/3 bg-surface-hover rounded"></div>
              <div class="h-4 w-1/4 bg-surface-hover rounded"></div>
              <div class="h-4 w-1/2 bg-surface-hover rounded"></div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template v-if="!loading && isMounted">
      <template v-if="displayedLists.length > 0">
        <div class="propeller-favorite-lists__list space-y-4">
          <template :key="list.id" v-for="(list, index) in displayedLists">
            <div
              @click="
                async (event) => {
                  if (editingListId !== String(list.id) && onListClick) {
                    onListClick(list.id);
                  }
                }
              "
              :data-editing="
                editingListId === String(list.id) ? 'true' : 'false'
              "
              :data-default="list.isDefault ? 'true' : 'false'"
              :class="
                'propeller-favorite-lists__item border border-border rounded-[var(--radius-container)] p-6 hover:bg-surface-hover transition-colors' +
                (editingListId !== String(list.id) && onListClick
                  ? ' cursor-pointer'
                  : '')
              "
            >
              <div class="flex justify-between items-start">
                <div class="flex-1">
                  <template v-if="editingListId === String(list.id)">
                    <div class="propeller-favorite-lists__edit space-y-4">
                      <div class="space-y-2">
                        <input
                          type="text"
                          placeholder="Enter list name"
                          class="propeller-favorite-lists__input max-w-md block w-full rounded-[var(--radius-control)] border border-input px-3 py-2 text-sm focus:border-primary focus:ring-primary"
                          :value="editListName"
                          @change="
                            async (e) => {
                              editListName = e.target.value;
                            }
                          "
                        />
                      </div>
                      <div class="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          class="propeller-favorite-lists__checkbox rounded border-input"
                          :id="`default-edit-${list.id}`"
                          :checked="editSetAsDefault"
                          @change="
                            async (e) => {
                              editSetAsDefault = e.target.checked;
                            }
                          "
                        /><label
                          class="propeller-favorite-lists__checkbox-label text-sm text-muted-foreground"
                          :for="`default-edit-${list.id}`"
                          >{{ getLabel("makeDefault", "Make default") }}</label
                        >
                      </div>
                      <div class="flex gap-2">
                        <button
                          class="propeller-favorite-lists__save-btn inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-[var(--radius-control)] text-primary-foreground bg-primary hover:bg-primary/80 disabled:opacity-50"
                          @click="
                            async (event) => handleUpdateList(String(list.id))
                          "
                          :disabled="!editListName.trim()"
                        >
                          {{ getLabel("editSave", "Save") }}</button
                        ><button
                          class="propeller-favorite-lists__cancel-btn inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-[var(--radius-control)] border border-input text-muted-foreground bg-card hover:bg-surface-hover"
                          @click="async (event) => handleCancelEdit()"
                        >
                          {{ getLabel("editCancel", "Cancel") }}
                        </button>
                      </div>
                    </div>
                  </template>

                  <template v-if="editingListId !== String(list.id)">
                    <div class="propeller-favorite-lists__display space-y-2">
                      <div class="flex items-center gap-2">
                        <span
                          class="propeller-favorite-lists__name text-xl font-semibold"
                          >{{ list.name }}</span
                        >
                        <template
                          v-if="
                            showDefaultIndicator !== false && list.isDefault
                          "
                        >
                          <span
                            class="propeller-favorite-lists__default-badge inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary"
                            >{{ getLabel("defaultBadge", "Default") }}</span
                          >
                        </template>
                      </div>
                      <div
                        class="propeller-favorite-lists__meta flex items-center gap-4 text-sm text-muted-foreground"
                      >
                        <template v-if="showLastModified !== false">
                          <div class="flex items-center gap-1">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect
                                width="18"
                                height="18"
                                x="3"
                                y="4"
                                rx="2"
                                ry="2"
                              ></rect>
                              <line x1="16" x2="16" y1="2" y2="6"></line>
                              <line x1="8" x2="8" y1="2" y2="6"></line>
                              <line x1="3" x2="21" y1="10" y2="10"></line></svg
                            >{{ getLabel("lastModified", "Last modified") }}:
                            {{ formatDate(list.updatedAt) }}
                          </div>
                        </template>

                        <template v-if="showItemsCount !== false">
                          <div class="flex items-center gap-1">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M16.5 9.4 7.55 4.24"></path>
                              <path
                                d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
                              ></path>
                              <polyline
                                points="3.29 7 12 12 20.71 7"
                              ></polyline>
                              <line x1="12" x2="12" y1="22" y2="12"></line></svg
                            >{{ getTotalCount(list) }}&nbsp;{{
                              getLabel("items", "items")
                            }}
                          </div>
                        </template>
                      </div>
                    </div>
                  </template>
                </div>
                <template
                  v-if="
                    showActions !== false && editingListId !== String(list.id)
                  "
                >
                  <div class="propeller-favorite-lists__actions flex gap-2">
                    <button
                      title="Edit"
                      class="propeller-favorite-lists__edit-btn h-8 w-8 p-0 inline-flex items-center justify-center rounded-[var(--radius-control)] text-muted-foreground hover:text-muted-foreground hover:bg-surface-hover"
                      @click="
                        async (e) => {
                          e.stopPropagation();
                          handleEditList(list);
                        }
                      "
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path
                          d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"
                        ></path>
                        <path d="m15 5 4 4"></path>
                      </svg></button
                    ><button
                      title="Delete"
                      class="propeller-favorite-lists__delete-btn h-8 w-8 p-0 inline-flex items-center justify-center rounded-[var(--radius-control)] text-destructive hover:text-destructive hover:bg-destructive/10"
                      @click="
                        async (e) => {
                          e.stopPropagation();
                          handleDeleteList(list);
                        }
                      "
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 6h18"></path>
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                </template>
              </div>
            </div>
          </template>
        </div>
      </template>

      <template v-if="displayedLists.length === 0">
        <div
          class="propeller-favorite-lists__empty border border-border rounded-[var(--radius-container)] p-12 text-center space-y-4"
        >
          <div
            class="propeller-favorite-lists__empty-icon-wrapper bg-surface-hover p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              class="propeller-favorite-lists__empty-icon text-foreground-subtle"
            >
              <path
                d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3.332.67-4.5 2.17C10.832 3.67 9.26 3 7.5 3A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
              ></path>
            </svg>
          </div>
          <div>
            <p
              class="propeller-favorite-lists__empty-title text-lg font-medium"
            >
              {{ getLabel("noLists", "No favorite lists") }}
            </p>
            <p
              class="propeller-favorite-lists__empty-message text-muted-foreground"
            >
              {{
                getLabel(
                  "noListsDescription",
                  "Start by creating a new list to save your items.",
                )
              }}
            </p>
          </div>
          <template v-if="allowFavoriteListCreate !== false">
            <button
              class="propeller-favorite-lists__create-btn inline-flex items-center px-4 py-2 text-sm font-medium rounded-[var(--radius-control)] text-primary-foreground bg-primary hover:bg-primary/80"
              @click="
                async (event) => {
                  showCreateModal = true;
                }
              "
            >
              {{ getLabel("createFirstList", "Create your first list") }}
            </button>
          </template>
        </div>
      </template>
    </template>

    <template v-if="showCreateModal">
      <div
        class="propeller-favorite-lists__create-modal fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      >
        <div
          class="propeller-favorite-lists__create-modal-content bg-card p-6 rounded-[var(--radius-container)] max-w-md w-full shadow-lg border"
        >
          <div class="flex justify-between items-center mb-4">
            <h3
              class="propeller-favorite-lists__create-modal-title text-xl font-bold"
            >
              {{ getLabel("createTitle", "Create New List") }}
            </h3>
            <button
              class="propeller-favorite-lists__create-modal-close h-8 w-8 p-0 inline-flex items-center justify-center rounded-[var(--radius-control)] text-muted-foreground hover:text-muted-foreground hover:bg-surface-hover"
              @click="
                async (event) => {
                  closeCreateModal();
                }
              "
            >
              ×
            </button>
          </div>
          <div class="space-y-4">
            <div class="space-y-2">
              <label
                class="propeller-favorite-lists__input-label text-sm font-medium"
                >Name</label
              ><input
                type="text"
                class="propeller-favorite-lists__input block w-full rounded-[var(--radius-control)] border border-input px-3 py-2 text-sm focus:border-primary focus:ring-primary"
                :value="newListName"
                @change="
                  async (e) => {
                    newListName = e.target.value;
                  }
                "
                :placeholder="getLabel('createPlaceholder', 'Enter list name')"
              />
            </div>
            <div class="flex items-center space-x-2">
              <input
                type="checkbox"
                id="create-set-default"
                class="propeller-favorite-lists__checkbox rounded border-input"
                :checked="newSetAsDefault"
                @change="
                  async (e) => {
                    newSetAsDefault = e.target.checked;
                  }
                "
              /><label
                for="create-set-default"
                class="propeller-favorite-lists__checkbox-label text-sm text-muted-foreground"
                >{{
                  getLabel("setAsDefault", "Set as default favorite list")
                }}</label
              >
            </div>
            <div class="flex justify-end gap-3 pt-2">
              <button
                class="propeller-favorite-lists__cancel-btn inline-flex items-center px-4 py-2 text-sm font-medium rounded-[var(--radius-control)] border border-input text-muted-foreground bg-card hover:bg-surface-hover"
                @click="
                  async (event) => {
                    closeCreateModal();
                  }
                "
              >
                {{ getLabel("cancelButton", "Cancel") }}</button
              ><button
                class="propeller-favorite-lists__save-btn inline-flex items-center px-4 py-2 text-sm font-medium rounded-[var(--radius-control)] text-primary-foreground bg-primary hover:bg-primary/80 disabled:opacity-50"
                @click="async (event) => handleCreateList()"
                :disabled="!newListName.trim()"
              >
                {{ getLabel("saveButton", "Save") }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template v-if="showDeleteModal && listToDelete">
      <div
        class="propeller-favorite-lists__delete-modal fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      >
        <div
          class="propeller-favorite-lists__delete-modal-content bg-card p-6 rounded-[var(--radius-container)] max-w-md w-full shadow-lg border"
        >
          <div class="flex justify-between items-center mb-4">
            <h3
              class="propeller-favorite-lists__delete-modal-title text-xl font-bold"
            >
              {{ getLabel("deleteTitle", "Delete Favorite List") }}
            </h3>
            <button
              class="propeller-favorite-lists__delete-modal-close h-8 w-8 p-0 inline-flex items-center justify-center rounded-[var(--radius-control)] text-muted-foreground hover:text-muted-foreground hover:bg-surface-hover"
              @click="async (event) => handleCancelDelete()"
            >
              ×
            </button>
          </div>
          <div class="space-y-4">
            <p class="propeller-favorite-lists__delete-prompt">
              {{ getLabel("deleteConfirm", "Are you sure you want to delete")
              }}<strong>&quot;{{ listToDelete?.name }}&quot;</strong>?
            </p>
            <p
              class="propeller-favorite-lists__delete-warning text-sm text-destructive"
            >
              {{ getLabel("deleteWarning", "This action cannot be undone.") }}
            </p>
          </div>
          <div class="flex justify-end gap-3 pt-6">
            <button
              class="propeller-favorite-lists__cancel-btn inline-flex items-center px-4 py-2 text-sm font-medium rounded-[var(--radius-control)] border border-input text-muted-foreground bg-card hover:bg-surface-hover"
              @click="async (event) => handleCancelDelete()"
            >
              {{ getLabel("cancelButton", "Cancel") }}</button
            ><button
              class="propeller-favorite-lists__confirm-delete-btn inline-flex items-center px-4 py-2 text-sm font-medium rounded-[var(--radius-control)] text-destructive-foreground bg-destructive hover:bg-destructive/90"
              @click="async (event) => handleConfirmDelete()"
            >
              {{ getLabel("deleteButton", "Delete") }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
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

export interface FavoriteListFormData {
  name: string;
  isDefault: boolean;
}
export interface FavoriteListsProps {
  /** The authenticated user (Contact or Customer) */
  user: Contact | Customer | null;

  /** The initialized GraphQL Client instance */
  graphqlClient: GraphQLClient;

  /** Callback when a list is clicked (navigate to detail) */
  onListClick?: (listId: string | number) => void;

  /** Limit the number of lists shown (e.g. 3 = last 3 modified). undefined = show all */
  limit?: number;

  /** Displays the "Default" badge on the favorite list (default: true) */
  showDefaultIndicator?: boolean;

  /** Displays the last modified date on the favorite list (default: true) */
  showLastModified?: boolean;

  /** Displays number of products and clusters contained in the favorite list (default: true) */
  showItemsCount?: boolean;

  /** Displays edit/delete action buttons on each list (default: true) */
  showActions?: boolean;

  /** Displays create new favorite list button (default: true) */
  allowFavoriteListCreate?: boolean;

  /** Custom class name */
  className?: string;

  /** Format date function override. If not provided, dates are formatted as dd/mm/YYYY */
  formatDate?: (dateString: string) => string;

  /** Localization labels */
  labels?: {
    lastModified?: string;
    items?: string;
    products?: string;
    clusters?: string;
    defaultBadge?: string;
    editSave?: string;
    editCancel?: string;
    makeDefault?: string;
    deleteTitle?: string;
    deleteConfirm?: string;
    deleteWarning?: string;
    deleteButton?: string;
    cancelButton?: string;
    createTitle?: string;
    createButton?: string;
    createPlaceholder?: string;
    setAsDefault?: string;
    saveButton?: string;
    noLists?: string;
    noListsDescription?: string;
    createFirstList?: string;
    loading?: string;
  };

  /** Action function triggered when creating a new favorite list. If not provided, the default action is executed */
  onCreate?: (favoriteListData: FavoriteListFormData) => void;

  /** Action function triggered when editing a favorite list. If not provided, the default action is executed */
  onEdit?: (
    favoriteListId: string,
    favoriteListData: FavoriteListFormData,
  ) => void;

  /** Action function triggered when deleting a favorite list. If not provided, the default action is executed */
  onDelete?: (favoriteListId: string) => void;

  /** Called after any list mutation (create, edit, delete) succeeds */
  onListChanged?: () => void;
}
interface FavoriteListsState {
  lists: FavoriteList[];
  loading: boolean;
  editingListId: string | null;
  editListName: string;
  editSetAsDefault: boolean;
  showDeleteModal: boolean;
  listToDelete: FavoriteList | null;
  showCreateModal: boolean;
  newListName: string;
  newSetAsDefault: boolean;
  isMounted: boolean;
  saving: boolean;
  fetchLists: () => void;
  handleEditList: (list: FavoriteList) => void;
  handleCancelEdit: () => void;
  handleUpdateList: (listId: string) => Promise<void>;
  handleDeleteList: (list: FavoriteList) => void;
  handleConfirmDelete: () => Promise<void>;
  handleCancelDelete: () => void;
  closeCreateModal: () => void;
  handleCreateList: () => Promise<void>;
  formatDate: (dateString: string) => string;
  getTotalCount: (list: FavoriteList) => number;
  getProductCount: (list: FavoriteList) => number;
  getClusterCount: (list: FavoriteList) => number;
  getLabel: (key: string, fallback: string) => string;
  displayedLists: FavoriteList[];
}

const props = withDefaults(defineProps<FavoriteListsProps>(), {
  showDefaultIndicator: true,
  showLastModified: true,
  showItemsCount: true,
  showActions: true,
  allowFavoriteListCreate: true,
});

const userRef = computed(() => props.user ?? null);

const {
  lists,
  loading,
  saving,
  editingListId,
  editListName,
  editSetAsDefault,
  newListName,
  newSetAsDefault,
  listToDelete,
  fetchLists,
  startEdit,
  cancelEdit,
  updateList,
  confirmDelete,
  deleteList,
  createList,
} = useFavorites({
  graphqlClient: props.graphqlClient,
  user: userRef,
  onCreate: props.onCreate,
  onEdit: props.onEdit,
  onDelete: props.onDelete,
  onListChanged: props.onListChanged,
});

// Local UI state not managed by composable
const showDeleteModal = ref<FavoriteListsState["showDeleteModal"]>(false);
const showCreateModal = ref<FavoriteListsState["showCreateModal"]>(false);
const isMounted = ref<FavoriteListsState["isMounted"]>(false);

onMounted(() => {
  isMounted.value = true;
  fetchLists();
});

const displayedLists = computed(() => {
  if (props.limit && props.limit > 0) {
    // Sort by updatedAt descending, then take the first N
    const sorted = [...lists.value].sort((a: FavoriteList, b: FavoriteList) => {
      const dateA = new Date(a.updatedAt || "").getTime();
      const dateB = new Date(b.updatedAt || "").getTime();
      return dateB - dateA;
    });
    return sorted.slice(0, props.limit);
  }
  return lists.value;
});

function handleEditList(
  list: FavoriteList,
): ReturnType<FavoriteListsState["handleEditList"]> {
  startEdit(list);
}
function handleCancelEdit(): ReturnType<
  FavoriteListsState["handleCancelEdit"]
> {
  cancelEdit();
}
async function handleUpdateList(
  listId: string,
): ReturnType<FavoriteListsState["handleUpdateList"]> {
  if (!editListName.value.trim() || saving.value) return;
  await updateList(listId);
}
function handleDeleteList(
  list: FavoriteList,
): ReturnType<FavoriteListsState["handleDeleteList"]> {
  confirmDelete(list);
  showDeleteModal.value = true;
}
async function handleConfirmDelete(): ReturnType<
  FavoriteListsState["handleConfirmDelete"]
> {
  await deleteList();
  showDeleteModal.value = false;
}
function handleCancelDelete(): ReturnType<
  FavoriteListsState["handleCancelDelete"]
> {
  showDeleteModal.value = false;
  listToDelete.value = null;
}
function closeCreateModal(): ReturnType<
  FavoriteListsState["closeCreateModal"]
> {
  showCreateModal.value = false;
}
async function handleCreateList(): ReturnType<
  FavoriteListsState["handleCreateList"]
> {
  if (!newListName.value.trim() || saving.value) return;
  await createList(newListName.value, newSetAsDefault.value);
  newListName.value = "";
  newSetAsDefault.value = false;
  closeCreateModal();
}
function formatDate(
  dateString: string,
): ReturnType<FavoriteListsState["formatDate"]> {
  if (props.formatDate) return props.formatDate(dateString);
  if (!dateString) return "-";
  const d = new Date(dateString);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}
function getProductCount(
  list: FavoriteList,
): ReturnType<FavoriteListsState["getProductCount"]> {
  const products = list.products;
  if (!products) return 0;
  if (products.itemsFound !== undefined) return products.itemsFound;
  if (products.items) return products.items.length;
  return 0;
}
function getClusterCount(
  list: FavoriteList,
): ReturnType<FavoriteListsState["getClusterCount"]> {
  const clusters = list.clusters;
  if (!clusters) return 0;
  if (clusters.itemsFound !== undefined) return clusters.itemsFound;
  if (clusters.items) return clusters.items.length;
  return 0;
}
function getTotalCount(
  list: FavoriteList,
): ReturnType<FavoriteListsState["getTotalCount"]> {
  return getProductCount(list) + getClusterCount(list);
}
function getLabel(
  key: string,
  fallback: string,
): ReturnType<FavoriteListsState["getLabel"]> {
  return _getLabel(props.labels, key, fallback);
}
</script>
