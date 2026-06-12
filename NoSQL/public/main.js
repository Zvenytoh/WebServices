const socket = io();
const productsElement = document.getElementById("products");
const statusElement = document.getElementById("status");
const productForm = document.getElementById("product-form");
const categoryForm = document.getElementById("category-form");
const categorySelect = document.getElementById("categoryId");

let products = [];
let categories = [];

socket.on("connect", () => {
  statusElement.textContent = "Live";
});

socket.on("disconnect", () => {
  statusElement.textContent = "Disconnected";
});

socket.on("products", (event) => {
  if (event.type === "deleted") {
    products = products.filter((product) => product._id !== event.product._id);
  }

  if (event.type === "created") {
    products = [event.product, ...products];
  }

  if (event.type === "updated") {
    products = products.map((product) =>
      product._id === event.product._id ? event.product : product,
    );
  }

  renderProducts();
});

socket.on("categories", (event) => {
  if (event.type === "created") {
    categories = [...categories, event.category];
    renderCategories();
  }
});

categoryForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(categoryForm);
  const response = await fetch("/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: formData.get("name") }),
  });

  if (response.ok) {
    categoryForm.reset();
    return;
  }

  const error = await response.json();
  alert(JSON.stringify(error, null, 2));
});

productForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(productForm);
  const categoryId = formData.get("categoryId");

  const response = await fetch("/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: formData.get("name"),
      about: formData.get("about"),
      price: Number(formData.get("price")),
      categoryIds: [categoryId],
    }),
  });

  if (response.ok) {
    productForm.reset();
    return;
  }

  const error = await response.json();
  alert(JSON.stringify(error, null, 2));
});

async function fetchProducts() {
  const response = await fetch("/products");
  products = await response.json();
  renderProducts();
}

async function fetchCategories() {
  const response = await fetch("/categories");
  categories = await response.json();
  renderCategories();
}

function renderCategories() {
  const selectedCategoryId = categorySelect.value;

  categorySelect.replaceChildren(
    ...[
      createOption("", "Choose a category"),
      ...categories.map((category) =>
        createOption(category._id, `${category.name} (${category._id})`),
      ),
    ],
  );

  if (categories.some((category) => category._id === selectedCategoryId)) {
    categorySelect.value = selectedCategoryId;
  }
}

function createOption(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function renderProducts() {
  productsElement.replaceChildren(
    ...products.map((product) => {
      const item = document.createElement("li");
      const categories = product.categories
        ? product.categories.map((category) => category.name).join(", ")
        : "";

      item.innerHTML = `
        <span class="product-title"></span>
        <span class="product-meta"></span>
        <span class="product-meta"></span>
      `;

      item.querySelector(".product-title").textContent = product.name;
      item.querySelectorAll(".product-meta")[0].textContent =
        `${product.about} - ${product.price} EUR`;
      item.querySelectorAll(".product-meta")[1].textContent =
        categories ? `Categories: ${categories}` : `ID: ${product._id}`;

      return item;
    }),
  );
}

fetchCategories();
fetchProducts();
