/*
##################################################################
get container holding the transcribed text
get container in which the osd viewer renders its div
##################################################################
*/
// string vars: input / cfg section

const OSD_container_spawnpoint_id = "OSD-container-spawnpoint";
const iiif_server_base_path =
  "https://iiif.acdh.oeaw.ac.at/iiif/images/todesurteile/";
const iiif_attribs = "/full/max/0/default.jpg";
const page_break_marker_classname = "pb";
const page_break_marker_image_attribute = "source";
/*
Change theses values to negative percentates/px if you want to narrow/expand
the region of the viewport whicht triggers a reload.
One possibly irritating behavior can be, that clicking on prev/next button 
scrolls the pb element outside the screen region that triggers reload. If this 
region is being empty, when the debounced function is running, no new image will 
be loaded. Expand the region that triggers reload in this case or increase the
top scroll offset of the targeted bp elements
*/
const top_viewport_threshold = "0px";
const bottom_viewport_threshold = "-65%";
// this is the options object for the intersection observer
const io_options = {
  rootMargin: `${top_viewport_threshold} 0% ${bottom_viewport_threshold} 0%`,
};

// get relevant elements/values
const OSD_container_spawnpoint = document.getElementById(
  OSD_container_spawnpoint_id
);
// const transcript_container = document.getElementById(transcript_container_id)
const height = screen.height;

// helper functions
// iiif stuff
function get_iif_link(filename) {
  return `${iiif_server_base_path}${filename}${iiif_attribs}`;
}

function isVisible(el) {
  var style = window.getComputedStyle(el);
  return style.display !== "none";
}

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

// simple implementation of debounce
// prevents loading a lot of images when
// scrolling fast through the page
// without setting unnecessary heuristic timeouts
function debounce(callback, wait) {
  let timeoutId = null;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      callback(...args);
    }, wait);
  };
}

function scroll_prev() {
  if (previous_pb_index == -1) {
    pb_elements[0].scrollIntoView();
  } else {
    pb_elements[previous_pb_index].scrollIntoView();
  }
}

function scroll_next() {
  if (next_pb_index > max_index) {
    pb_elements[max_index].scrollIntoView();
  } else {
    pb_elements[next_pb_index].scrollIntoView();
  }
}

// since the page loading process is sometimes hard to predict
// it might happen that the loading the page with an url anchor param
// doesn't trigger the intersectionobserver callback
// to prevent any hassle the following functions handle the inital scrolling
// if such param is present in url

function load_initial_image() {
  // depending on the margins you set for you intersection observer
  // and the position of you lb elements on the page the initial image
  //   might not be in the observerd zone when the page is loaded, such that
  //   no image is loaded when the page is loaded. Try removing the conditional
  //   check for a window hash in this function if you encounter this problem
  if (window.location.hash) {
    let first_pb_element_in_viewport = undefined;
    for (let pb_element of pb_elements) {
      if (isInViewport(pb_element)) {
        first_pb_element_in_viewport = pb_element;
        break;
      }
    }
    if (viewer.world.getItemCount() > 1) {
      viewer.world.removeItem(viewer.world.getItemAt(1));
    }
    handle_new_image(first_pb_element_in_viewport);
  }
}

/*
##################################################################
get all image urls stored in span el class tei-xml-images
creates an array for osd viewer with static images
##################################################################
*/
var pb_elements = document.getElementsByClassName(page_break_marker_classname);
var pb_elements_array = Array.from(pb_elements);

/*
##################################################################
initialize osd
##################################################################
*/

let initial_osd_visible = isVisible(OSD_container_spawnpoint);
if (initial_osd_visible) {
  OSD_container_spawnpoint.style.height = `${String(height / 1.5)}px`;
  OSD_container_spawnpoint.style.width = "auto";
}
var viewer = OpenSeadragon({
  id: OSD_container_spawnpoint_id,
  prefixUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/openseadragon/4.0.0/images/",
  sequenceMode: true,
  showNavigator: true,
  constrainDuringPan: true,
  visibilityRatio: 1,
  showNavigationControl: true,
  showSequenceControl: true,
});

// if anybody can explain to me, why I need that function
// even though I defined a callback in the image loader, removing the old
// image, I would be really happy or at least a little bit
viewer.world.addHandler("add-item", () => {
  while (viewer.world.getItemCount() > 1) {
    console.log(viewer.world.getItemCount());
    viewer.world.removeItem(viewer.world.getItemAt(0));
  }
  console.log(viewer.world.getItemCount());
});
/*
##################################################################
index and previous index for click navigation in osd viewer
locate index of anchor element
##################################################################
*/

var next_pb_index = 0;
var previous_pb_index = -1;
const max_index = pb_elements.length - 1;
var prev = document.querySelector("div[title='Previous page']");
var next = document.querySelector("div[title='Next page']");
prev.style.opacity = 1;
next.style.opacity = 1;

/* These two values define the size of the part
of the viewport that should trigger an image reload
whenever it gets enterd by a pb element. Negative values
make that zone smaller, positive expand it.*/
function handle_new_image(current_pb_element) {
  let current_pb_index = pb_elements_array.findIndex(
    (el) => el === current_pb_element
  );
  next_pb_index = current_pb_index + 1;
  previous_pb_index = current_pb_index - 1;
  new_image_url = get_iif_link(
    current_pb_element.getAttribute(page_break_marker_image_attribute)
  );
  old_image = viewer.world.getItemAt(0);
  load_new_image_with_check(new_image_url, old_image);
}

function load_new_image_with_check(new_image_url, old_image) {
  viewer.addSimpleImage({
    url: new_image_url,
    success: function (event) {
      function ready() {
        if (viewer.world.getItemCount() > 1 && old_image) {
          viewer.world.removeItem(old_image);
        }
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

/*
 call some stuff
*/
const debounced_lb_handler = debounce(handle_visible_lbs, 1000);
// create the observer, its default scope (root element) is the viewport,
// but you could change it eg. to body etc.
let viewportObserver = new IntersectionObserver(handle_visible_lbs, io_options);
// give the observer some lbs to observer
pb_elements_array.forEach((entry) => {
  viewportObserver.observe(entry);
});
prev.addEventListener("click", () => {
  scroll_prev();
});
next.addEventListener("click", () => {
  scroll_next();
});

if (initial_osd_visible) {
  load_initial_image();
}
