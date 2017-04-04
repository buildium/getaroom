app.updateResourceCard = function(resource) {
  var resourceId = resource.resourceId;
  var resourceName = resource.resourceName;
  var resourceDescription = resource.resourceDescription;
  var resourceType = resource.resourceType;

  var card = app.visibleCards[resourceId];
  if (!card) {
    card = app.cardTemplate.cloneNode(true);
    card.classList.remove('cardTemplate');
    card.removeAttribute('hidden');
    app.container.appendChild(card);
    app.visibleCards[resourceId] = card;
  }

  card.querySelector('.location').textContent = resourceName;
  card.querySelector('.type').textContent = resourceType;
  card.querySelector('.description').textContent = resourceDescription;
  if (app.isLoading) {
    app.spinner.setAttribute('hidden', true);
    app.container.removeAttribute('hidden');
    app.isLoading = false;
  }
};
