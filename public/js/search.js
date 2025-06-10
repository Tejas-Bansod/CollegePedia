/**
 * @file public/js/search.js
 * @description Client-side script for college search functionality with suggestions and text highlighting.
 */
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search-input');
  const suggestionsContainer = document.getElementById('search-suggestions');
  const errorContainer = document.getElementById('search-error');
  const loadingSpinner = document.getElementById('loading-spinner');

  // Debounce function to limit API calls
  const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(null, args), delay);
    };
  };

  // Fetch suggestions from API
  const fetchSuggestions = async (query) => {
    if (!query.trim()) {
      suggestionsContainer.innerHTML = '';
      suggestionsContainer.classList.add('hidden');
      return;
    }

    try {
      loadingSpinner.classList.remove('hidden');
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      
      // Check if the response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Unexpected response format. Expected JSON.');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.msg || 'Failed to fetch colleges. Please try again.');
      }

      renderSuggestions(data);
    } catch (error) {
      errorContainer.textContent = error.message;
      errorContainer.classList.remove('hidden');
      suggestionsContainer.innerHTML = '';
      suggestionsContainer.classList.add('hidden');
    } finally {
      loadingSpinner.classList.add('hidden');
    }
  };

  // Highlight the search query in the text
  const highlightText = (text, query) => {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
  };

  // Render suggestions in dropdown
  const renderSuggestions = (colleges) => {
    suggestionsContainer.innerHTML = '';
    const query = searchInput.value.trim(); // Get the current search query
    if (colleges.length === 0) {
      suggestionsContainer.innerHTML = '<div class="p-2 text-gray-500 text-sm">No colleges found</div>';
      suggestionsContainer.classList.remove('hidden');
      return;
    }

    colleges.forEach(college => {
      const div = document.createElement('div');
      div.className = 'flex items-center p-2 hover:bg-gray-100 cursor-pointer'; // Reduced padding to p-2
      const imageSrc = college.image && college.image.trim() !== '' ? college.image : '/images/placeholder.jpg';
      const highlightedName = highlightText(college.clg_name, query); // Highlight the matching text
      div.innerHTML = `
        <img src="${imageSrc}" alt="${college.clg_name}" class="w-8 h-8 object-cover rounded mr-2" loading="lazy" onerror="this.src='/images/placeholder.jpg'"> <!-- Smaller image -->
        <span class="text-gray-700 font-medium text-sm">${highlightedName}</span> <!-- Added font-medium and text-sm -->
      `;
      div.addEventListener('click', () => {
        window.location.href = `/api/information/${college.info_id}`;
      });
      suggestionsContainer.appendChild(div);
    });
    suggestionsContainer.classList.remove('hidden');
  };

  // Hide suggestions when clicking outside
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
      suggestionsContainer.innerHTML = '';
      suggestionsContainer.classList.add('hidden');
      errorContainer.classList.add('hidden');
    }
  });

  // Handle input with debounce
  searchInput.addEventListener('input', debounce((e) => {
    errorContainer.classList.add('hidden');
    fetchSuggestions(e.target.value);
  }, 300));

  // Clear suggestions on focus
  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim()) {
      fetchSuggestions(searchInput.value);
    }
  });
});