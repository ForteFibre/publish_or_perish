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

add_executable(stage4_patrol src/stage4_patrol.cpp)
ament_target_dependencies(stage4_patrol rclcpp geometry_msgs)

add_executable(stage5_farmer src/stage5_farmer.cpp)
ament_target_dependencies(stage5_farmer rclcpp geometry_msgs nav_msgs std_msgs std_srvs)

install(TARGETS stage4_patrol stage5_farmer DESTINATION lib/${PROJECT_NAME})
install(DIRECTORY launch DESTINATION share/${PROJECT_NAME})

ament_package()
