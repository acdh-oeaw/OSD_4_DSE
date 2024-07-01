const container_facs_1 = document.getElementById("container_facs_1");
const text_wrapper = document.getElementById("text-resize");
container_facs_1.style.height = `${String(screen.height / 2)}px`;
/*
##################################################################
get all image urls stored in span el class tei-xml-images
creates an array for osd viewer with static images
##################################################################
*/
const navbar_wrapper = document.getElementById("wrapper-navbar");
const image_rights = document.getElementsByClassName("image_rights")[0];

function calculate_facsContainer_height() {
  // calcutlates hight of osd container based on heigt of screen - (height of navbar + img rights&buttons)
  let image_rights_height = image_rights.getBoundingClientRect().height;
  let new_container_height =
    window.innerHeight -
    (window.innerHeight / 10 + //this is necessary, cause container has fixed top val of 10%
      image_rights_height);
  return Math.round(new_container_height);
}

// initially resizing the facs container to max
// needs to be done before calling the viewer constructor,
// since it doesnt update size
resize_facsContainer();

var pb_elements = document.getElementsByClassName("pb");
var pb_elements_array = Array.from(pb_elements);
var tileSources = [];
var img = pb_elements[0].getAttribute("source");
var imageURL = {
  type: "image",
  url: img,
};
tileSources.push(imageURL);

/*
##################################################################
initialize osd
##################################################################
*/
const viewer = new OpenSeadragon.Viewer({
  id: "container_facs_1",
  prefixUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/openseadragon/4.1.0/images/",
  tileSources: tileSources,
  visibilityRatio: 1,
  sequenceMode: true,
  showNavigationControl: true,
  showNavigator: false,
  showSequenceControl: false,
  showZoomControl: true,
  zoomInButton: "osd_zoom_in_button",
  zoomOutButton: "osd_zoom_out_button",
  homeButton: "osd_zoom_reset_button",
  constrainDuringPan: true,
});

viewer.viewport.goHome = function () {
  fitVertically_align_left_bottom();
};

function fitVertically_align_left_bottom() {
  let initial_bounds = viewer.viewport.getBounds();
  let ratio = initial_bounds.width / initial_bounds.height;
  let tiledImage = viewer.world.getItemAt(viewer.world.getItemCount() - 1);
  if (ratio > tiledImage.contentAspectX) {
    var new_width = tiledImage.normHeight * ratio;
    var new_bounds = new OpenSeadragon.Rect(
      0,
      0,
      new_width,
      tiledImage.normHeight
    );
  } else {
    var new_height = 1 / ratio;
    let bounds_y = -(new_height - tiledImage.normHeight);
    var new_bounds = new OpenSeadragon.Rect(0, bounds_y, 1, new_height);
  }
  viewer.viewport.fitBounds(new_bounds, true);
}

viewer.addHandler("tile-loaded", (x) => {
  fitVertically_align_left_bottom(viewer);
});
/*
##################################################################
index and previous index for click navigation in osd0viewer
locate index of anchor element
##################################################################
*/
var next_pb_index = 0;
var previous_pb_index = -1;
const a_elements = document.getElementsByClassName("anchor-pb");
const max_index = a_elements.length - 1;
const prev = document.getElementById("osd_prev_button");
const next = document.getElementById("osd_next_button");

/* test with intersection observer */
// defines how much of viewport should be igno
/* These two values define the size of the part
of the viewport that should trigger an image reload
whenever it gets enterd by a pb element. Negative values
make that zone smaller, positive expand it.*/
let top_viewport_threshold = "-5%";
let bottom_viewport_threshold = "-85%";
// this is the options object for the intersection observer
let io_options = {
  rootMargin: `${top_viewport_threshold} 0% ${bottom_viewport_threshold} 0%`,
};
/* this function changes the indexnumbers to keept
the buttons up to date and triggers the image loading*/
function handle_new_image(current_pb_element) {
  let current_pb_index = pb_elements_array.findIndex(
    (el) => el === current_pb_element
  );
  next_pb_index = current_pb_index + 1;
  previous_pb_index = current_pb_index - 1;
  new_image_url = current_pb_element.getAttribute("source");
  old_image = viewer.world.getItemAt(0);
  load_new_image(new_image_url, old_image);
}

function load_new_image(new_image_url, old_image) {
  viewer.addSimpleImage({
    url: new_image_url,
    success: function (event) {
      function ready() {
        viewer.world.removeItem(old_image);
      }
      // test if item was loaded and trigger function to remove previous item
      if (event.item) {
        ready();
      } else {
        event.item.addOnceHandler("fully-loaded-change", ready());
      }
    },
  });
}

function debounce(callback, wait) {
  let timeoutId = null;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      callback(...args);
    }, wait);
  };
}

/*this function is the callback for the intersection observer
it gets called whenever an element leaves or enters the defined 
section of the viewport*/
var last_loaded_entry = "";
function handle_visible_lbs(entries, observer) {
  entries.forEach((entry) => {
    var intersecting = entries.filter((entry) => entry.isIntersecting == true);
    if (intersecting.length > 0) {
      first_intersecting_entry = intersecting[0];
      if (first_intersecting_entry != last_loaded_entry) {
        handle_new_image(first_intersecting_entry.target);
        last_loaded_entry = first_intersecting_entry;
      }
    }
  });
}

const debounced_lb_handler = debounce(handle_visible_lbs, 1000);
// create the observer, its default scope (root element) is the viewport,
// but you could change it eg. to body etc.
let viewportObserver = new IntersectionObserver(handle_visible_lbs, io_options);
// give the observer some lbs to observer
pb_elements_array.forEach((entry) => {
  viewportObserver.observe(entry);
});

// since the page loading process is sometimes hard to predict
// it might happen that the loading the page with an url anchor param
// doesn't trigger the intersectionobserver callback
// to prevent any hassle the following functions handle the inital scrolling
// if such param is present in url

function isInViewport(element) {
  // Get the bounding client rectangle position in the viewport
  var bounding = element.getBoundingClientRect();
  if (
    bounding.top >= 0 &&
    bounding.left >= 0 &&
    bounding.bottom <=
      (window.innerHeight || document.documentElement.clientHeight) &&
    bounding.right <=
      (window.innerWidth || document.documentElement.clientWidth)
  ) {
    return true;
  } else {
    return false;
  }
}

function load_initial_image() {
  if (window.location.hash) {
    let first_pb_element_in_viewport = undefined;
    for (let pb_element of pb_elements) {
      if (isInViewport(pb_element)) {
        first_pb_element_in_viewport = pb_element;
        break;
      };
    };
    handle_new_image(first_pb_element_in_viewport);
  }
}

load_initial_image();
/*
##################################################################
accesses osd viewer prev and next button to switch image and
scrolls to next or prev span element with class pb (pagebreak)
##################################################################
*/

prev.style.opacity = 1;
next.style.opacity = 1;

function scroll_prev() {
  if (previous_pb_index == -1) {
    a_elements[0].scrollIntoView();
  } else {
    a_elements[previous_pb_index].scrollIntoView();
  }
}

function scroll_next() {
  if (next_pb_index > max_index) {
    a_elements[max_index].scrollIntoView();
  } else {
    a_elements[next_pb_index].scrollIntoView();
  }
}

prev.addEventListener("click", () => {
  scroll_prev();
});
next.addEventListener("click", () => {
  scroll_next();
});

/*
##################################################################
functions to check the size of facs container
##################################################################
*/

/* change size of facs container */
function resize_facsContainer() {
  let new_container_height = calculate_facsContainer_height();
  if (new_container_height != container_facs_1.clientHeight) {
    container_facs_1.style.height = `${String(new_container_height)}px`;
    return true;
  }
  return false;
}

addEventListener("resize", function (event) {
  let resized = resize_facsContainer();
  if (resized) {
    viewer.forceResize();
    fitVertically_align_left_bottom(viewer);
  }
});
