cmake_minimum_required(VERSION 3.8)
project(publish_or_perish_answers)

if(CMAKE_COMPILER_IS_GNUCXX OR CMAKE_CXX_COMPILER_ID MATCHES "Clang")
  add_compile_options(-Wall -Wextra -Wpedantic)
endif()

find_package(ament_cmake REQUIRED)
find_package(rclcpp REQUIRED)
find_package(geometry_msgs REQUIRED)
find_package(nav_msgs REQUIRED)
find_package(std_msgs REQUIRED)
find_package(std_srvs REQUIRED)

add_executable(stage2_patrol src/stage2_patrol.cpp)
ament_target_dependencies(stage2_patrol rclcpp geometry_msgs)

add_executable(stage3_farmer src/stage3_farmer.cpp)
ament_target_dependencies(stage3_farmer rclcpp geometry_msgs nav_msgs std_msgs std_srvs)

install(TARGETS stage2_patrol stage3_farmer DESTINATION lib/${PROJECT_NAME})
install(DIRECTORY launch DESTINATION share/${PROJECT_NAME})

ament_package()
